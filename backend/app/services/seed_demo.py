"""Database seed script for pre-configured judge demo accounts.

Idempotently provisions the four designated demo accounts for evaluation:
  1. admin@cit-demo.test (Admin)
  2. coordinator@cit-demo.test (Department Coordinator - CSE)
  3. faculty@cit-demo.test (Faculty - CSE)
  4. spectra@cit-demo.test (Club Representative - Spectra)

Passwords are cryptographically hashed using PBKDF2-HMAC-SHA256 with unique salts.
Plaintext passwords and credentials are never stored in the database or logged.
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging
import os
from typing import Any

from app.config import DEMO_MODE
from app.models.user import DemoAccountPublicInfo, UserRole
from app.services.auth_service import AuthService
from app.services.database import get_db_connection, init_db

logger = logging.getLogger(__name__)

# Pre-configured Judge Demo Accounts
# Plaintext passwords are used ONLY during initial cryptographic hashing;
# they are never written to the database or returned in any API responses.
DEMO_ACCOUNTS: list[dict[str, Any]] = [
    {
        "id": "usr_demo_admin",
        "email": "admin@cit-demo.test",
        "password": "CIT_Admin@2026!",
        "full_name": "CIT Campus Administrator",
        "role": UserRole.ADMIN,
        "department": None,
        "club": None,
        "dashboard_scope": "Full Campus Access: Overview, Timetable, Exams, Bookings, Rescheduling, AI Assistant, Settings",
    },
    {
        "id": "usr_demo_coordinator",
        "email": "coordinator@cit-demo.test",
        "password": "CIT_Coord@2026!",
        "full_name": "CSE Department Coordinator",
        "role": UserRole.DEPARTMENT_COORDINATOR,
        "department": "CSE",
        "club": None,
        "dashboard_scope": "Department Dashboard: CSE Timetable, Faculty Workload, Exam Venues & Department Bookings",
    },
    {
        "id": "usr_demo_faculty",
        "email": "faculty@cit-demo.test",
        "password": "CIT_Faculty@2026!",
        "full_name": "Dr. CSE Faculty Member",
        "role": UserRole.FACULTY,
        "department": "CSE",
        "club": None,
        "dashboard_scope": "Faculty Portal: Teaching Schedule, Invigilation Duty, Departmental Venues & Guest Lectures",
    },
    {
        "id": "usr_demo_spectra",
        "email": "spectra@cit-demo.test",
        "password": "CIT_Spectra@2026!",
        "full_name": "Spectra Club Representative",
        "role": UserRole.CLUB_REPRESENTATIVE,
        "department": None,
        "club": "Spectra",
        "dashboard_scope": "Club Portal: Spectra Week Booking Requests, Equipment Checks, Quota Tracking & AI Booking Copilot",
    },
]


def seed_demo_accounts(force: bool = False) -> dict[str, int]:
    """Seed or update the four judge demo accounts idempotently.
    
    Args:
        force: If True, bypasses DEMO_MODE environment check.
        
    Returns:
        Summary counts of created and updated accounts.
    """
    if not (DEMO_MODE or force):
        logger.info("DEMO_MODE is disabled; skipping demo account seeding.")
        return {"created": 0, "updated": 0, "skipped": len(DEMO_ACCOUNTS)}

    init_db()
    conn = get_db_connection()
    now_iso = datetime.now(timezone.utc).isoformat()
    created_count = 0
    updated_count = 0

    try:
        cursor = conn.cursor()
        for account in DEMO_ACCOUNTS:
            email = account["email"].lower()
            password = account["password"]
            full_name = account["full_name"]
            role_val = account["role"].value if isinstance(account["role"], UserRole) else str(account["role"])
            department = account["department"]
            club = account["club"]

            # Derive cryptographic hash and unique salt
            hashed_pw, salt = AuthService.hash_password(password)

            # Check if account already exists
            cursor.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", (email,))
            existing = cursor.fetchone()

            if existing:
                # Update existing account credentials & attributes idempotently
                cursor.execute(
                    """
                    UPDATE users
                    SET hashed_password = ?,
                        salt = ?,
                        full_name = ?,
                        role = ?,
                        department = ?,
                        club = ?,
                        is_active = 1,
                        is_verified = 1,
                        updated_at = ?
                    WHERE LOWER(email) = LOWER(?)
                    """,
                    (hashed_pw, salt, full_name, role_val, department, club, now_iso, email),
                )
                updated_count += 1
                logger.info("Updated existing demo account: %s [role=%s]", email, role_val)
            else:
                # Insert new active and verified demo account
                cursor.execute(
                    """
                    INSERT INTO users (
                        id, email, hashed_password, salt, full_name, role,
                        department, club, is_active, is_verified, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
                    """,
                    (
                        account["id"],
                        email,
                        hashed_pw,
                        salt,
                        full_name,
                        role_val,
                        department,
                        club,
                        now_iso,
                        now_iso,
                    ),
                )
                created_count += 1
                logger.info("Created new demo account: %s [role=%s]", email, role_val)

        conn.commit()
    finally:
        conn.close()

    return {"created": created_count, "updated": updated_count, "total": len(DEMO_ACCOUNTS)}


def get_demo_accounts_metadata() -> list[DemoAccountPublicInfo]:
    """Retrieve public metadata describing the 4 judge demo accounts.
    
    CRITICAL: Passwords and sensitive credentials are NEVER returned.
    """
    return [
        DemoAccountPublicInfo(
            email=acc["email"],
            full_name=acc["full_name"],
            role=acc["role"],
            department=acc["department"],
            club=acc["club"],
            dashboard_scope=acc["dashboard_scope"],
        )
        for acc in DEMO_ACCOUNTS
    ]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = seed_demo_accounts(force=True)
    print(f"Seed completed: {result}")

