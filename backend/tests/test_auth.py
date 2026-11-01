"""Automated test suite for judge demo accounts and authentication architecture.

Verifies:
  - All four judge demo accounts can authenticate with their pre-configured credentials.
  - Correct backend role, department, and club assignment for each account.
  - Session Bearer token creation and validation via /api/v1/auth/me.
  - Safe, repeatable database seeding with zero duplicates on successive runs.
  - Passwords are cryptographically hashed and never stored in plaintext.
  - Public demo account metadata endpoints do not leak passwords or hashes.
  - Session token invalidation upon logout.
  - Rejection of invalid credentials and malformed tokens.
"""

from __future__ import annotations

import sqlite3
import pytest
from fastapi.testclient import TestClient

from app.config import DATABASE_PATH
from app.models.user import UserRole
from app.services.auth_service import AuthService
from app.services.database import get_db_connection, init_db
from app.services.seed_demo import DEMO_ACCOUNTS, seed_demo_accounts

BASE_AUTH_URL = "/api/v1/auth"


@pytest.fixture(autouse=True)
def setup_demo_db() -> None:
    """Ensure database is initialized, test accounts isolated, and demo accounts seeded."""
    init_db()
    # Isolate test database by removing non-demo test registrations
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            DELETE FROM users 
            WHERE email NOT IN (
                'admin@cit-demo.test',
                'coordinator@cit-demo.test',
                'faculty@cit-demo.test',
                'spectra@cit-demo.test'
            )
            """
        )
        conn.commit()
    finally:
        conn.close()
    seed_demo_accounts(force=True)


class TestJudgeDemoAccountLogins:
    """Verifies authentication and permission assignments for all four judge accounts."""

    def test_admin_account_login_and_permissions(self, client: TestClient) -> None:
        """admin@cit-demo.test authenticates with admin role and full campus authority."""
        res = client.post(
            f"{BASE_AUTH_URL}/login",
            json={"email": "admin@cit-demo.test", "password": "CIT_Admin@2026!"},
        )
        assert res.status_code == 200, res.text
        data = res.json()

        assert "access_token" in data
        assert data["token_type"] == "bearer"
        user = data["user"]
        assert user["email"] == "admin@cit-demo.test"
        assert user["role"] == "admin"
        assert user["full_name"] == "CIT Campus Administrator"
        assert user["is_active"] is True
        assert user["is_verified"] is True
        # Plaintext passwords and hashes must never be in response
        assert "password" not in user
        assert "hashed_password" not in user
        assert "salt" not in user

    def test_coordinator_account_login_and_permissions(self, client: TestClient) -> None:
        """coordinator@cit-demo.test receives department_coordinator role and CSE department."""
        res = client.post(
            f"{BASE_AUTH_URL}/login",
            json={"email": "coordinator@cit-demo.test", "password": "CIT_Coord@2026!"},
        )
        assert res.status_code == 200, res.text
        data = res.json()

        user = data["user"]
        assert user["email"] == "coordinator@cit-demo.test"
        assert user["role"] == "department_coordinator"
        assert user["department"] == "CSE"
        assert user["is_active"] is True

    def test_faculty_account_login_and_permissions(self, client: TestClient) -> None:
        """faculty@cit-demo.test receives faculty role and CSE department."""
        res = client.post(
            f"{BASE_AUTH_URL}/login",
            json={"email": "faculty@cit-demo.test", "password": "CIT_Faculty@2026!"},
        )
        assert res.status_code == 200, res.text
        data = res.json()

        user = data["user"]
        assert user["email"] == "faculty@cit-demo.test"
        assert user["role"] == "faculty"
        assert user["department"] == "CSE"
        assert user["is_active"] is True

    def test_spectra_club_account_login_and_permissions(self, client: TestClient) -> None:
        """spectra@cit-demo.test receives club_representative role and Spectra club."""
        res = client.post(
            f"{BASE_AUTH_URL}/login",
            json={"email": "spectra@cit-demo.test", "password": "CIT_Spectra@2026!"},
        )
        assert res.status_code == 200, res.text
        data = res.json()

        user = data["user"]
        assert user["email"] == "spectra@cit-demo.test"
        assert user["role"] == "club_representative"
        assert user["club"] == "Spectra"
        assert user["is_active"] is True


class TestAuthenticationAndSessionWorkflow:
    """Verifies token retrieval, /me profile endpoint, and logout behavior."""

    def test_me_endpoint_with_valid_token(self, client: TestClient) -> None:
        """GET /api/v1/auth/me resolves the authenticated profile using Bearer token."""
        login_res = client.post(
            f"{BASE_AUTH_URL}/login",
            json={"email": "admin@cit-demo.test", "password": "CIT_Admin@2026!"},
        )
        token = login_res.json()["access_token"]

        me_res = client.get(
            f"{BASE_AUTH_URL}/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["email"] == "admin@cit-demo.test"
        assert me_data["role"] == "admin"

    def test_me_endpoint_missing_token_unauthorized(self, client: TestClient) -> None:
        """GET /api/v1/auth/me without token returns HTTP 401."""
        res = client.get(f"{BASE_AUTH_URL}/me")
        assert res.status_code == 401

    def test_me_endpoint_invalid_token_unauthorized(self, client: TestClient) -> None:
        """GET /api/v1/auth/me with bogus token returns HTTP 401."""
        res = client.get(
            f"{BASE_AUTH_URL}/me",
            headers={"Authorization": "Bearer invalid_token_xyz_123"},
        )
        assert res.status_code == 401

    def test_logout_invalidates_token(self, client: TestClient) -> None:
        """POST /api/v1/auth/logout invalidates token so subsequent /me fails."""
        login_res = client.post(
            f"{BASE_AUTH_URL}/login",
            json={"email": "faculty@cit-demo.test", "password": "CIT_Faculty@2026!"},
        )
        token = login_res.json()["access_token"]

        logout_res = client.post(
            f"{BASE_AUTH_URL}/logout",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert logout_res.status_code == 200

        # Token should now be rejected
        subsequent_res = client.get(
            f"{BASE_AUTH_URL}/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert subsequent_res.status_code == 401

    def test_invalid_password_rejected(self, client: TestClient) -> None:
        """Incorrect password returns HTTP 401."""
        res = client.post(
            f"{BASE_AUTH_URL}/login",
            json={"email": "admin@cit-demo.test", "password": "WrongPassword@123"},
        )
        assert res.status_code == 401

    def test_nonexistent_email_rejected(self, client: TestClient) -> None:
        """Unknown email returns HTTP 401."""
        res = client.post(
            f"{BASE_AUTH_URL}/login",
            json={"email": "unknown@cit-demo.test", "password": "CIT_Admin@2026!"},
        )
        assert res.status_code == 401


class TestDatabaseSecurityAndIdempotency:
    """Verifies security guarantees, password hashing, and idempotent seeding."""

    def test_passwords_are_cryptographically_hashed(self) -> None:
        """Passwords in the database are hashed with unique salt and never plaintext."""
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT email, hashed_password, salt FROM users")
            rows = cursor.fetchall()

            demo_passwords = [
                "CIT_Admin@2026!",
                "CIT_Coord@2026!",
                "CIT_Faculty@2026!",
                "CIT_Spectra@2026!",
            ]

            assert len(rows) >= 4
            for row in rows:
                hashed = row["hashed_password"]
                salt = row["salt"]
                # Must be 64-char hex string from sha256
                assert len(hashed) == 64
                assert len(salt) == 32
                # Plaintext must never match stored hash or salt
                for raw_pw in demo_passwords:
                    assert raw_pw != hashed
                    assert raw_pw != salt
        finally:
            conn.close()

    def test_seed_script_is_idempotent(self) -> None:
        """Running seed_demo_accounts repeatedly does not create duplicate accounts."""
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM users")
            initial_count = cursor.fetchone()[0]

            # Run seed again twice
            seed_demo_accounts(force=True)
            seed_demo_accounts(force=True)

            cursor.execute("SELECT COUNT(*) FROM users")
            new_count = cursor.fetchone()[0]

            assert initial_count == new_count
        finally:
            conn.close()

    def test_public_demo_accounts_metadata_endpoint_safe(self, client: TestClient) -> None:
        """GET /api/v1/auth/demo-accounts does not leak passwords, hashes, or salts."""
        res = client.get(f"{BASE_AUTH_URL}/demo-accounts")
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 4

        for item in items:
            assert "email" in item
            assert "role" in item
            assert "dashboard_scope" in item
            assert "password" not in item
            assert "hashed_password" not in item
            assert "salt" not in item


class TestUserRegistration:
    """Tests the new user registration flow supporting glassmorphism sign-up."""

    def test_register_new_faculty_success(self, client: TestClient) -> None:
        """New faculty registration succeeds and returns valid bearer token."""
        res = client.post(
            f"{BASE_AUTH_URL}/register",
            json={
                "email": "dr.priya.sharma@cit.ac.in",
                "password": "SecurePassword123!",
                "full_name": "Dr. Priya Sharma",
                "role": "faculty",
                "department": "CSE",
            },
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert "access_token" in data
        assert data["user"]["email"] == "dr.priya.sharma@cit.ac.in"
        assert data["user"]["full_name"] == "Dr. Priya Sharma"
        assert data["user"]["role"] == "faculty"
        assert data["user"]["department"] == "CSE"

        # Verify newly registered user can log in with credentials
        login_res = client.post(
            f"{BASE_AUTH_URL}/login",
            json={
                "email": "dr.priya.sharma@cit.ac.in",
                "password": "SecurePassword123!",
            },
        )
        assert login_res.status_code == 200
        assert login_res.json()["user"]["email"] == "dr.priya.sharma@cit.ac.in"

    def test_register_duplicate_email_rejected(self, client: TestClient) -> None:
        """Attempting to register with an existing email returns 400."""
        res = client.post(
            f"{BASE_AUTH_URL}/register",
            json={
                "email": "admin@cit-demo.test",
                "password": "AnyPassword123!",
                "full_name": "Imposter Admin",
                "role": "admin",
            },
        )
        assert res.status_code == 400
        assert "already exists" in res.json()["detail"].lower()


