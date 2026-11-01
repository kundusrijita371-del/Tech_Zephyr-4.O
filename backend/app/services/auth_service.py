"""Authentication and password cryptography service.

Implements PBKDF2-HMAC-SHA256 password hashing with unique per-user salts,
constant-time digest verification, bearer session management, and strict
backend-enforced role access control.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import logging
import secrets
from typing import Any
import sqlite3

from app.models.user import UserResponse, UserRole
from app.services.database import get_db_connection

logger = logging.getLogger(__name__)

# Security parameters (PBKDF2 iterations balanced for fast response and brute-force resistance)
PBKDF2_ITERATIONS = 50_000
SALT_BYTES = 16
SESSION_EXPIRY_DAYS = 7


class AuthService:
    """Core cryptographic and session authorization service."""

    @staticmethod
    def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
        """Derive a cryptographic hash and salt using PBKDF2-HMAC-SHA256.
        
        Args:
            password: The raw plaintext password.
            salt: Existing salt if re-hashing; otherwise generates new random salt.
            
        Returns:
            Tuple of (hex_hashed_password, hex_salt).
        """
        if salt is None:
            salt = secrets.token_hex(SALT_BYTES)
            
        derived_bytes = hashlib.pbkdf2_hmac(
            hash_name="sha256",
            password=password.encode("utf-8"),
            salt=salt.encode("utf-8"),
            iterations=PBKDF2_ITERATIONS,
        )
        return derived_bytes.hex(), salt

    @staticmethod
    def verify_password(password: str, hashed_password: str, salt: str) -> bool:
        """Verify candidate password against stored hash using constant-time comparison."""
        expected_hash, _ = AuthService.hash_password(password, salt=salt)
        return secrets.compare_digest(expected_hash, hashed_password)

    @staticmethod
    def register_user(
        email: str,
        password: str,
        full_name: str | None = None,
        role: UserRole | str = UserRole.FACULTY,
        department: str | None = "CSE",
        club: str | None = None,
    ) -> UserResponse:
        """Register a new user account with secure PBKDF2 hashing.
        
        Enforces:
        - Email uniqueness check.
        - Admin accounts cannot be self-registered (public signup defaults to faculty/club).
        - Generates unique ID and salts.
        """
        clean_email = email.strip().lower()
        if not clean_email or "@" not in clean_email:
            raise ValueError("A valid email address is required.")
        if len(password) < 6:
            raise ValueError("Password must be at least 6 characters.")

        # Admin cannot be registered via public signup
        assigned_role = UserRole(role) if isinstance(role, str) else role
        if assigned_role == UserRole.ADMIN:
            assigned_role = UserRole.FACULTY

        clean_name = (full_name or "").strip() or clean_email.split("@")[0].replace(".", " ").title()
        user_id = f"usr_{secrets.token_hex(6)}"
        now_iso = datetime.now(timezone.utc).isoformat()

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", (clean_email,))
            if cursor.fetchone():
                raise ValueError("An account with this email address already exists.")

            hashed_pw, salt = AuthService.hash_password(password)
            fac_id = "F01" if assigned_role == UserRole.FACULTY else None

            cursor.execute(
                """
                INSERT INTO users (
                    id, email, hashed_password, salt, full_name, role,
                    department, club, faculty_id, is_active, is_verified, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
                """,
                (
                    user_id,
                    clean_email,
                    hashed_pw,
                    salt,
                    clean_name,
                    assigned_role.value,
                    department,
                    club,
                    fac_id,
                    now_iso,
                    now_iso,
                ),
            )
            conn.commit()

            return UserResponse(
                id=user_id,
                email=clean_email,
                full_name=clean_name,
                role=assigned_role,
                department=department,
                club=club,
                faculty_id=fac_id,
                is_active=True,
                is_verified=True,
                created_at=now_iso,
            )
        finally:
            conn.close()

    @staticmethod
    def authenticate_user(email: str, password: str) -> UserResponse | None:
        """Authenticate user by email and password without leaking credential details."""
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
                (email.strip(),),
            )
            row = cursor.fetchone()
            if not row:
                return None

            # Verify account active status
            if not row["is_active"]:
                logger.warning("Authentication attempted for inactive user: %s", email)
                return None

            # Verify cryptographic hash
            if not AuthService.verify_password(password, row["hashed_password"], row["salt"]):
                return None

            fac_id = row["faculty_id"] if "faculty_id" in row.keys() else None
            if not fac_id and UserRole(row["role"]) == UserRole.FACULTY:
                fac_id = "F01"

            return UserResponse(
                id=row["id"],
                email=row["email"],
                full_name=row["full_name"],
                role=UserRole(row["role"]),
                department=row["department"],
                club=row["club"],
                faculty_id=fac_id,
                is_active=bool(row["is_active"]),
                is_verified=bool(row["is_verified"]),
                created_at=row["created_at"],
            )
        finally:
            conn.close()

    @staticmethod
    def create_session(user_id: str) -> str:
        """Create and persist a secure session bearer token."""
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        expires = now + timedelta(days=SESSION_EXPIRY_DAYS)

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO user_sessions (token, user_id, created_at, expires_at)
                VALUES (?, ?, ?, ?)
                """,
                (token, user_id, now.isoformat(), expires.isoformat()),
            )
            conn.commit()
            return token
        finally:
            conn.close()

    @staticmethod
    def get_user_by_token(token: str) -> UserResponse | None:
        """Resolve an active session token into a sanitized UserResponse."""
        if not token:
            return None

        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT s.expires_at, u.*
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ?
                """,
                (token,),
            )
            row = cursor.fetchone()
            if not row:
                return None

            # Check expiry
            expires_at = datetime.fromisoformat(row["expires_at"])
            if expires_at < datetime.now(timezone.utc):
                cursor.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
                conn.commit()
                return None

            if not row["is_active"]:
                return None

            fac_id = row["faculty_id"] if "faculty_id" in row.keys() else None
            if not fac_id and UserRole(row["role"]) == UserRole.FACULTY:
                fac_id = "F01"

            return UserResponse(
                id=row["id"],
                email=row["email"],
                full_name=row["full_name"],
                role=UserRole(row["role"]),
                department=row["department"],
                club=row["club"],
                faculty_id=fac_id,
                is_active=bool(row["is_active"]),
                is_verified=bool(row["is_verified"]),
                created_at=row["created_at"],
            )
        finally:
            conn.close()

    @staticmethod
    def invalidate_session(token: str) -> None:
        """Invalidate and delete a session token upon logout."""
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
            conn.commit()
        finally:
            conn.close()

