"""Integration tests for Spectra Week venue booking API endpoints.

Covers:
- GET /api/v1/bookings
- GET /api/v1/bookings/{request_id}
- POST /api/v1/bookings/generate
- GET /api/v1/bookings/validation
- POST /api/v1/bookings/evaluate
- POST /api/v1/bookings/{request_id}/decision
"""

from __future__ import annotations

import json
import pytest
from fastapi.testclient import TestClient

from app.config import BOOKINGS_DRAFT_PATH, SCHEDULE_FINAL_PATH
from app.main import app
from app.services.booking_service import BookingService


@pytest.fixture(autouse=True)
def clean_booking_service_state():
    BookingService.clear_state()
    yield
    BookingService.clear_state()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestBookingAPI:
    def test_get_all_bookings_returns_25_items(self, client: TestClient) -> None:
        response = client.get("/api/v1/bookings")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 25

        # Check fields of first item
        item = data[0]
        assert "id" in item
        assert "requester" in item
        assert "role" in item
        assert "requested_category" in item
        assert "effective_category" in item
        assert "decision" in item
        assert item["decision"] is not None

    def test_get_single_booking_by_id(self, client: TestClient) -> None:
        response = client.get("/api/v1/bookings/BR-01")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "BR-01"
        assert data["role"] == "admin"
        assert data["effective_category"] == "institute_event"
        assert data["decision"]["status"] == "approved"
        assert data["decision"]["room_id"] == "AUD"

    def test_get_single_booking_not_found(self, client: TestClient) -> None:
        response = client.get("/api/v1/bookings/NON-EXISTENT")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_generate_bookings_endpoint(self, client: TestClient) -> None:
        response = client.post("/api/v1/bookings/generate")
        assert response.status_code == 200
        data = response.json()

        assert data["is_valid"] is True
        assert data["hard_violation_count"] == 0
        assert data["hard_violations"] == []
        assert data["warnings"] == []
        assert data["booking_score"] >= 65.0
        assert data["booking_score_max"] == 70
        assert data["approved_count"] >= 20
        assert data["priority_inversions"] == []

        # Verify disk export
        assert BOOKINGS_DRAFT_PATH.exists()
        assert SCHEDULE_FINAL_PATH.exists()

        final_sched = json.loads(SCHEDULE_FINAL_PATH.read_text(encoding="utf-8"))
        assert "fest_week" in final_sched
        assert len(final_sched["fest_week"]["bookings"]) == 25

    def test_get_validation_endpoint(self, client: TestClient) -> None:
        # Generate first
        client.post("/api/v1/bookings/generate")

        # Fetch validation
        response = client.get("/api/v1/bookings/validation")
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is True
        assert data["hard_violation_count"] == 0
        assert data["priority_inversions"] == []

    def test_evaluate_booking_endpoint(self, client: TestClient) -> None:
        payload = {
            "role": "club",
            "requested_category": "club_event",
            "attendance": 50,
            "duration_periods": 2,
            "windows": [{"day": "MON", "from_period": 11, "to_period": 12}],
            "room_types": ["seminar_hall", "classroom"],
            "needs": ["projector"],
            "mandatory_for_groups": [],
        }
        response = client.post("/api/v1/bookings/evaluate", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["effective_category"] == "club_event"
        assert data["is_feasible"] is True
        assert len(data["compatible_rooms"]) > 0
        assert "recommendation" in data
        assert data["recommendation"]["status"] in ("approved", "alternative_offered")

    def test_cannot_approve_cancelled_request(self, client: TestClient) -> None:
        # First generate
        client.post("/api/v1/bookings/generate")

        # Attempt to manually approve BR-04 (which is in cancellations)
        payload = {
            "status": "approved",
            "day": "TUE",
            "start_period": 10,
            "end_period": 12,
            "room_id": "SH-1",
            "reason": "Unauthorized manual approval attempt",
        }
        response = client.post("/api/v1/bookings/BR-04/decision", json=payload)
        assert response.status_code == 400
        assert "cancelled" in response.json()["detail"].lower()

