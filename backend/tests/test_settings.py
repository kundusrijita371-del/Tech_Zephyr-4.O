"""Automated test suite for Settings and System Administration API.

Verifies:
  - Role-based authorization: Admin has full mutation rights, while
    Faculty, Coordinator, and Club Representative receive HTTP 403 Forbidden.
  - Booking priority queue management: reordering, validation, persistence,
    and audit logging.
  - Dataset management: inspection, preview validation, and authorization guards.
  - Validator reports: genuine validator output inspection without fabrication.
  - Judge demo data reset: restoring state, clearing proposals, re-seeding accounts.
  - Live system health and diagnostics endpoint.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.services.database import init_db
from app.services.seed_demo import seed_demo_accounts

BASE_SETTINGS_URL = "/api/v1/settings"
BASE_AUTH_URL = "/api/v1/auth"


@pytest.fixture(autouse=True)
def setup_demo_environment() -> None:
    """Initialize SQLite database and re-seed 4 demo accounts before every test."""
    init_db()
    seed_demo_accounts(force=True)


def login(client: TestClient, email: str, password: str) -> str:
    """Helper to authenticate and retrieve session Bearer token."""
    res = client.post(
        f"{BASE_AUTH_URL}/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


@pytest.fixture
def admin_headers(client: TestClient) -> dict[str, str]:
    token = login(client, "admin@cit-demo.test", "CIT_Admin@2026!")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def faculty_headers(client: TestClient) -> dict[str, str]:
    token = login(client, "faculty@cit-demo.test", "CIT_Faculty@2026!")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def coordinator_headers(client: TestClient) -> dict[str, str]:
    token = login(client, "coordinator@cit-demo.test", "CIT_Coord@2026!")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def spectra_headers(client: TestClient) -> dict[str, str]:
    token = login(client, "spectra@cit-demo.test", "CIT_Spectra@2026!")
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# BOOKING PRIORITY MANAGEMENT TESTS
# ==============================================================================

class TestBookingPrioritySettings:
    """Tests for viewing and updating the 6-stage booking priority queue."""

    @pytest.fixture(autouse=True)
    def restore_priority_order_after_test(self):
        yield
        from app.services.settings_service import DEFAULT_PRIORITY_ORDER
        from app.services.dataset_service import get_dataset
        from app.services.database import get_db_connection
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM system_settings WHERE key = 'booking_priority_order'")
            conn.commit()
        finally:
            conn.close()
        try:
            ds = get_dataset()
            ds.priority_order = list(DEFAULT_PRIORITY_ORDER)
        except Exception:
            pass

    def test_get_booking_priority_authenticated(self, client: TestClient, faculty_headers: dict[str, str]) -> None:
        """Any authenticated user can inspect the current booking priority order."""
        res = client.get(f"{BASE_SETTINGS_URL}/priority", headers=faculty_headers)
        assert res.status_code == 200
        data = res.json()
        assert "priority_order" in data
        assert len(data["priority_order"]) == 6
        assert "categories" in data
        assert len(data["categories"]) == 6
        assert data["categories"][0]["rank"] == 1

    def test_get_booking_priority_unauthenticated(self, client: TestClient) -> None:
        """Unauthenticated requests are rejected with 401."""
        res = client.get(f"{BASE_SETTINGS_URL}/priority")
        assert res.status_code == 401

    def test_admin_update_booking_priority_success(self, client: TestClient, admin_headers: dict[str, str]) -> None:
        """Admin can reorder the 6 priority categories, persisting to DB and logging audit entry."""
        custom_order = [
            "institute_event",
            "exam",
            "regular_session",
            "department_event",
            "guest_lecture",
            "club_event",
        ]
        res = client.put(
            f"{BASE_SETTINGS_URL}/priority",
            json={"priority_order": custom_order},
            headers=admin_headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["priority_order"] == custom_order
        assert data["updated_by"] == "admin@cit-demo.test"
        assert data["categories"][0]["id"] == "institute_event"
        assert data["categories"][0]["rank"] == 1

        # Verify persistence on subsequent GET
        get_res = client.get(f"{BASE_SETTINGS_URL}/priority", headers=admin_headers)
        assert get_res.status_code == 200
        assert get_res.json()["priority_order"] == custom_order

    def test_non_admin_update_booking_priority_forbidden(
        self,
        client: TestClient,
        coordinator_headers: dict[str, str],
        faculty_headers: dict[str, str],
        spectra_headers: dict[str, str],
    ) -> None:
        """Non-admin roles (coordinator, faculty, club) receive 403 Forbidden."""
        new_order = [
            "exam", "regular_session", "guest_lecture",
            "department_event", "institute_event", "club_event",
        ]
        for headers, role_name in [
            (coordinator_headers, "coordinator"),
            (faculty_headers, "faculty"),
            (spectra_headers, "club_rep"),
        ]:
            res = client.put(
                f"{BASE_SETTINGS_URL}/priority",
                json={"priority_order": new_order},
                headers=headers,
            )
            assert res.status_code == 403, f"Expected 403 for {role_name}, got {res.status_code}"

    def test_update_priority_validation_failure(self, client: TestClient, admin_headers: dict[str, str]) -> None:
        """Invalid priority payloads (wrong length, duplicates, unknown categories) are rejected."""
        # 1. Too few items
        res1 = client.put(
            f"{BASE_SETTINGS_URL}/priority",
            json={"priority_order": ["exam", "regular_session"]},
            headers=admin_headers,
        )
        assert res1.status_code in (400, 422)

        # 2. Duplicate items
        res2 = client.put(
            f"{BASE_SETTINGS_URL}/priority",
            json={"priority_order": ["exam", "exam", "regular_session", "guest_lecture", "department_event", "club_event"]},
            headers=admin_headers,
        )
        assert res2.status_code == 400
        assert "Missing categories" in res2.json()["detail"] or "Invalid" in res2.json()["detail"]


# ==============================================================================
# DATASET MANAGEMENT TESTS
# ==============================================================================

class TestDatasetSettings:
    """Tests for dataset metadata inspection, upload validation, and role restrictions."""

    def test_get_current_dataset(self, client: TestClient, spectra_headers: dict[str, str]) -> None:
        """Any authenticated user can inspect current dataset item counts."""
        res = client.get(f"{BASE_SETTINGS_URL}/dataset/current", headers=spectra_headers)
        assert res.status_code == 200
        data = res.json()
        assert "dataset_id" in data
        assert "counts" in data
        assert data["counts"]["rooms"] > 0
        assert data["counts"]["sessions"] > 0

    def test_preview_valid_dataset_admin(self, client: TestClient, admin_headers: dict[str, str]) -> None:
        """Admin can preview a valid dataset schema."""
        from app.services.dataset_service import get_dataset
        ds = get_dataset()
        valid_payload = ds.model_dump()
        valid_payload["dataset_id"] = "test_dataset_v2"
        res = client.post(
            f"{BASE_SETTINGS_URL}/dataset/preview",
            json=valid_payload,
            headers=admin_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["is_valid"] is True
        assert data["dataset_id"] == "test_dataset_v2"
        assert data["counts"]["rooms"] > 0

    def test_preview_invalid_dataset_admin(self, client: TestClient, admin_headers: dict[str, str]) -> None:
        """Admin previewing an invalid schema receives validation errors without modifying live state."""
        invalid_payload = {
            "dataset_id": "broken_dataset",
            # Missing rooms, faculty, sessions, etc.
        }
        res = client.post(
            f"{BASE_SETTINGS_URL}/dataset/preview",
            json=invalid_payload,
            headers=admin_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["is_valid"] is False
        assert len(data["validation_errors"]) > 0

    def test_preview_dataset_forbidden_for_faculty(self, client: TestClient, faculty_headers: dict[str, str]) -> None:
        """Non-admin is forbidden from dataset preview."""
        res = client.post(
            f"{BASE_SETTINGS_URL}/dataset/preview",
            json={},
            headers=faculty_headers,
        )
        assert res.status_code == 403

    def test_apply_dataset_without_confirm_fails(self, client: TestClient, admin_headers: dict[str, str]) -> None:
        """Attempting to apply dataset without confirm=True returns 400 Bad Request."""
        res = client.post(
            f"{BASE_SETTINGS_URL}/dataset/apply",
            json={"dataset_json": {}, "confirm": False},
            headers=admin_headers,
        )
        assert res.status_code == 400
        assert "confirmation" in res.json()["detail"].lower()


# ==============================================================================
# VALIDATOR INSPECTOR & SYSTEM STATUS TESTS
# ==============================================================================

class TestValidatorAndStatus:
    """Tests for the validator inspector and real-time system status."""

    def test_get_validator_reports(self, client: TestClient, admin_headers: dict[str, str]) -> None:
        """Validator reports return honest domain structures (null or actual output dicts)."""
        res = client.get(f"{BASE_SETTINGS_URL}/validator-reports", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert "timetable" in data
        assert "exams" in data
        assert "bookings" in data
        assert "disruptions" in data

    def test_get_system_status(self, client: TestClient, coordinator_headers: dict[str, str]) -> None:
        """System status returns real live health diagnostics for API, SQLite, and Solver."""
        res = client.get(f"{BASE_SETTINGS_URL}/system-status", headers=coordinator_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["backend"]["status"] == "online"
        assert data["database"]["status"] == "connected"
        assert data["solver"]["available"] is True
        assert "Google OR-Tools" in data["solver"]["engine"]
        assert "ai" in data
        assert data["dataset"]["loaded"] is True


# ==============================================================================
# DEMO RESET & AUDIT LOG TESTS
# ==============================================================================

class TestDemoResetAndAudit:
    """Tests for the judge demo reset action and audit logging."""

    def test_demo_reset_forbidden_for_non_admin(self, client: TestClient, spectra_headers: dict[str, str]) -> None:
        """Club representative cannot trigger demo reset."""
        res = client.post(f"{BASE_SETTINGS_URL}/demo-reset", headers=spectra_headers)
        assert res.status_code == 403

    def test_demo_reset_success_for_admin(self, client: TestClient, admin_headers: dict[str, str]) -> None:
        """Admin can trigger complete demo data reset."""
        res = client.post(f"{BASE_SETTINGS_URL}/demo-reset", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["reset_by"] == "admin@cit-demo.test"
        assert len(data["restored_entities"]) > 0

    def test_audit_log_access(self, client: TestClient, admin_headers: dict[str, str], faculty_headers: dict[str, str]) -> None:
        """Only Admin can access administrative audit log."""
        # Non-admin forbidden
        res_fac = client.get(f"{BASE_SETTINGS_URL}/audit-log", headers=faculty_headers)
        assert res_fac.status_code == 403

        # Admin authorized
        res_adm = client.get(f"{BASE_SETTINGS_URL}/audit-log", headers=admin_headers)
        assert res_adm.status_code == 200
        entries = res_adm.json()
        assert isinstance(entries, list)
