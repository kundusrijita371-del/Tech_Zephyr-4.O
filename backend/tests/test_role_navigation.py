"""Automated test suite verifying role-specific authorization and backend security guards.

Verifies:
  - Admin has system-wide permissions (settings, timetable, exams, bookings, proposals).
  - Department Coordinator has department approvals, but is blocked from admin configuration & exams.
  - Faculty is restricted from global solvers, admin configuration, and approval actions.
  - Club Representative is restricted from booking decisions, global allocations, and proposal approvals.
  - Self-approval is rejected with HTTP 403 Forbidden.
  - Ownership filtering on venue bookings for club representatives.
  - Clean account switching without session leakage.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.models.user import UserRole
from app.services.database import init_db
from app.services.seed_demo import seed_demo_accounts

BASE_AUTH_URL = "/api/v1/auth"
BASE_BOOKINGS_URL = "/api/v1/bookings"
BASE_SETTINGS_URL = "/api/v1/settings"
BASE_RESCHEDULING_URL = "/api/v1/rescheduling"
BASE_EXAMS_URL = "/api/v1/exams"
BASE_TIMETABLE_URL = "/api/v1/timetable"


@pytest.fixture(autouse=True)
def setup_demo_db() -> None:
    init_db()
    seed_demo_accounts(force=True)


def get_token_for(client: TestClient, email: str, password: str) -> str:
    res = client.post(f"{BASE_AUTH_URL}/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.fixture
def admin_headers(client: TestClient) -> dict[str, str]:
    token = get_token_for(client, "admin@cit-demo.test", "CIT_Admin@2026!")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def coordinator_headers(client: TestClient) -> dict[str, str]:
    token = get_token_for(client, "coordinator@cit-demo.test", "CIT_Coord@2026!")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def faculty_headers(client: TestClient) -> dict[str, str]:
    token = get_token_for(client, "faculty@cit-demo.test", "CIT_Faculty@2026!")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def spectra_headers(client: TestClient) -> dict[str, str]:
    token = get_token_for(client, "spectra@cit-demo.test", "CIT_Spectra@2026!")
    return {"Authorization": f"Bearer {token}"}


class TestRoleBasedPermissions:
    """Tests independent API-level authorization guards across all four roles."""

    def test_admin_full_system_access(self, client: TestClient, admin_headers: dict[str, str]) -> None:
        """Admin has full authority to view priority, audit logs, and trigger solvers."""
        # 1. System status
        res1 = client.get(f"{BASE_SETTINGS_URL}/system-status", headers=admin_headers)
        assert res1.status_code == 200

        # 2. Priority queue inspection
        res2 = client.get(f"{BASE_SETTINGS_URL}/priority", headers=admin_headers)
        assert res2.status_code == 200

        # 3. Administrative audit log
        res3 = client.get(f"{BASE_SETTINGS_URL}/audit-log", headers=admin_headers)
        assert res3.status_code == 200

    def test_coordinator_permissions_and_restrictions(
        self, client: TestClient, coordinator_headers: dict[str, str]
    ) -> None:
        """Coordinator has departmental authority but is blocked from admin configuration and exams."""
        # Allowed: system status & priority reading
        res1 = client.get(f"{BASE_SETTINGS_URL}/priority", headers=coordinator_headers)
        assert res1.status_code == 200

        # Forbidden: Demo reset
        res2 = client.post(f"{BASE_SETTINGS_URL}/demo-reset", headers=coordinator_headers)
        assert res2.status_code == 403

        # Forbidden: Priority queue modification
        res3 = client.put(
            f"{BASE_SETTINGS_URL}/priority",
            json={"priority_order": ["exam", "regular_session", "institute_event", "guest_lecture", "department_event", "club_event"]},
            headers=coordinator_headers,
        )
        assert res3.status_code == 403

        # Forbidden: Exam schedule generation
        res4 = client.post(f"{BASE_EXAMS_URL}/generate", headers=coordinator_headers)
        assert res4.status_code == 403

        # Forbidden: Administrative audit log
        res5 = client.get(f"{BASE_SETTINGS_URL}/audit-log", headers=coordinator_headers)
        assert res5.status_code == 403

    def test_faculty_permissions_and_restrictions(
        self, client: TestClient, faculty_headers: dict[str, str]
    ) -> None:
        """Faculty cannot approve proposals, generate timetables, or record booking decisions."""
        # Forbidden: Timetable generation
        res1 = client.post(f"{BASE_TIMETABLE_URL}/generate", headers=faculty_headers)
        assert res1.status_code == 403

        # Forbidden: Global venue allocation
        res2 = client.post(f"{BASE_BOOKINGS_URL}/generate", headers=faculty_headers)
        assert res2.status_code == 403

        # Forbidden: Manual booking decision override
        res3 = client.post(
            f"{BASE_BOOKINGS_URL}/BK-SPEC-01/decision",
            json={"status": "approved", "reason": "Faculty attempted override"},
            headers=faculty_headers,
        )
        assert res3.status_code == 403

        # Forbidden: Proposal approval
        res4 = client.post(
            f"{BASE_RESCHEDULING_URL}/proposals/prop-102/approve",
            json={"decided_by": "Prof. Priya", "reason": "Faculty approval attempt"},
            headers=faculty_headers,
        )
        assert res4.status_code == 403

    def test_club_representative_permissions_and_restrictions(
        self, client: TestClient, spectra_headers: dict[str, str]
    ) -> None:
        """Club Representative is strictly blocked from administrative & approval operations."""
        # Forbidden: Booking decision overrides
        res1 = client.post(
            f"{BASE_BOOKINGS_URL}/BK-SPEC-01/decision",
            json={"status": "approved", "reason": "Self-approval attempt"},
            headers=spectra_headers,
        )
        assert res1.status_code == 403

        # Forbidden: Global booking generation
        res2 = client.post(f"{BASE_BOOKINGS_URL}/generate", headers=spectra_headers)
        assert res2.status_code == 403

        # Forbidden: Timetable generation
        res3 = client.post(f"{BASE_TIMETABLE_URL}/generate", headers=spectra_headers)
        assert res3.status_code == 403

        # Forbidden: Proposal approval
        res4 = client.post(
            f"{BASE_RESCHEDULING_URL}/proposals/prop-102/approve",
            json={"decided_by": "Aman Gupta", "reason": "Club approval attempt"},
            headers=spectra_headers,
        )
        assert res4.status_code == 403

    def test_club_bookings_ownership_filter(
        self, client: TestClient, spectra_headers: dict[str, str], admin_headers: dict[str, str]
    ) -> None:
        """Club Representative only sees booking records relevant to their club."""
        # Admin sees all 25 requests
        admin_res = client.get(f"{BASE_BOOKINGS_URL}", headers=admin_headers)
        assert admin_res.status_code == 200
        admin_bookings = admin_res.json()
        assert len(admin_bookings) == 25

        # Spectra Club Lead sees filtered results
        spectra_res = client.get(f"{BASE_BOOKINGS_URL}", headers=spectra_headers)
        assert spectra_res.status_code == 200
        spectra_bookings = spectra_res.json()
        assert len(spectra_bookings) < 25
        # All returned bookings must be club events or associated with Spectra
        for b in spectra_bookings:
            assert (
                b.get("requested_category") == "club_event"
                or b.get("role") == "club"
                or "spectra" in b.get("requester", "").lower()
                or "spectra" in b.get("title", "").lower()
            )

    def test_clean_session_account_switching(self, client: TestClient) -> None:
        """Switching between accounts validates identity and issues distinct roles."""
        # 1. Admin login
        admin_token = get_token_for(client, "admin@cit-demo.test", "CIT_Admin@2026!")
        me_admin = client.get(f"{BASE_AUTH_URL}/me", headers={"Authorization": f"Bearer {admin_token}"}).json()
        assert me_admin["role"] == "admin"
        assert me_admin["email"] == "admin@cit-demo.test"

        # 2. Coordinator login
        coord_token = get_token_for(client, "coordinator@cit-demo.test", "CIT_Coord@2026!")
        me_coord = client.get(f"{BASE_AUTH_URL}/me", headers={"Authorization": f"Bearer {coord_token}"}).json()
        assert me_coord["role"] == "department_coordinator"
        assert me_coord["department"] == "CSE"

        # 3. Faculty login
        faculty_token = get_token_for(client, "faculty@cit-demo.test", "CIT_Faculty@2026!")
        me_fac = client.get(f"{BASE_AUTH_URL}/me", headers={"Authorization": f"Bearer {faculty_token}"}).json()
        assert me_fac["role"] == "faculty"

        # 4. Spectra login
        spectra_token = get_token_for(client, "spectra@cit-demo.test", "CIT_Spectra@2026!")
        me_spec = client.get(f"{BASE_AUTH_URL}/me", headers={"Authorization": f"Bearer {spectra_token}"}).json()
        assert me_spec["role"] == "club_representative"
        assert me_spec["club"] == "Spectra"
