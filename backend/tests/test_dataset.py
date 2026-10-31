"""Automated test suite for CIT Dataset Loader and FastAPI APIs.

Covers:
  - Successful dataset loading and parsing
  - Exact dataset entity counts verification
  - Missing dataset file error handling (DatasetFileNotFoundError)
  - Invalid JSON syntax error handling (DatasetInvalidJSONError)
  - Missing required top-level keys error handling (DatasetKeyMissingError)
  - Incorrect data types / schema violation handling (DatasetTypeError)
  - /health endpoint
  - /api/v1/dataset/summary endpoint
  - Resource endpoints (/rooms, /faculty, /sessions, /groups)
  - 404 responses for non-existent IDs
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

import pytest

from app.models.dataset import Dataset, DatasetSummary
from app.services.dataset_service import (
    DatasetFileNotFoundError,
    DatasetInvalidJSONError,
    DatasetKeyMissingError,
    DatasetService,
    DatasetTypeError,
    get_dataset,
    get_dataset_summary,
    load_dataset_from_path,
)

if TYPE_CHECKING:
    from fastapi.testclient import TestClient

BASE_URL = "/api/v1/dataset"


# ===========================================================================
# 1. Dataset Service & Loading Tests
# ===========================================================================

class TestDatasetLoading:
    """Tests covering dataset loading, schema validation, and error states."""

    def test_successful_dataset_loading(self) -> None:
        """Verify the official cit_public.json loads without errors."""
        ds = get_dataset()
        assert isinstance(ds, Dataset)
        assert ds.dataset_id == "cit-public-v1"
        assert ds.institute == "Chilika Institute of Technology (fictional)"

    def test_expected_entity_counts(self) -> None:
        """Verify all entity counts match the official CIT specification."""
        ds = get_dataset()
        assert len(ds.rooms) == 27
        assert len(ds.faculty) == 40
        assert len(ds.student_groups) == 14
        assert len(ds.courses) == 62
        assert len(ds.sessions) == 189
        assert len(ds.booking_requests) == 25
        assert len(ds.cancellations) == 1
        assert len(ds.exams) == 41
        assert len(ds.room_unavailability) == 2

    def test_calendar_integrity(self) -> None:
        """Verify calendar structure (MON-FRI, 9 teaching periods, 4 event periods)."""
        calendar = get_dataset().calendar
        assert calendar.days == ["MON", "TUE", "WED", "THU", "FRI"]
        assert len(calendar.periods) == 13

        teaching = [p for p in calendar.periods if p.teaching]
        event_only = [p for p in calendar.periods if not p.teaching]
        assert len(teaching) == 9
        assert len(event_only) == 4
        assert calendar.lab_start_periods == [2, 6]

    def test_singleton_cache(self) -> None:
        """Ensure get_dataset returns the cached instance."""
        first = get_dataset()
        second = get_dataset()
        assert first is second

    def test_missing_dataset_file(self, tmp_path: Path) -> None:
        """Verify DatasetFileNotFoundError is raised when file does not exist."""
        non_existent = tmp_path / "does_not_exist.json"
        with pytest.raises(DatasetFileNotFoundError) as exc_info:
            load_dataset_from_path(non_existent)
        assert "not found" in str(exc_info.value).lower()

    def test_invalid_json(self, tmp_path: Path) -> None:
        """Verify DatasetInvalidJSONError is raised when file contains corrupt JSON."""
        corrupt_file = tmp_path / "corrupt.json"
        corrupt_file.write_text("{ unquoted_key: invalid syntax ", encoding="utf-8")
        with pytest.raises(DatasetInvalidJSONError) as exc_info:
            load_dataset_from_path(corrupt_file)
        assert "invalid json" in str(exc_info.value).lower()

    def test_missing_required_top_level_keys(self, tmp_path: Path) -> None:
        """Verify DatasetKeyMissingError is raised when required keys are missing."""
        incomplete_file = tmp_path / "incomplete.json"
        incomplete_file.write_text(
            json.dumps({"dataset_id": "test", "institute": "Test Institute"}),
            encoding="utf-8",
        )
        with pytest.raises(DatasetKeyMissingError) as exc_info:
            load_dataset_from_path(incomplete_file)
        assert "missing required top-level keys" in str(exc_info.value).lower()

    def test_incorrect_root_type(self, tmp_path: Path) -> None:
        """Verify DatasetTypeError is raised when root is a list instead of a dict."""
        array_file = tmp_path / "array.json"
        array_file.write_text(json.dumps([1, 2, 3]), encoding="utf-8")
        with pytest.raises(DatasetTypeError) as exc_info:
            load_dataset_from_path(array_file)
        assert "root must be a json object" in str(exc_info.value).lower()

    def test_incorrect_data_types_in_entities(self, tmp_path: Path) -> None:
        """Verify DatasetTypeError is raised when entity field types are wrong."""
        ds = get_dataset()
        data = ds.model_dump()
        # Corrupt a room capacity to be a string instead of an int
        data["rooms"][0]["capacity"] = "invalid_capacity_string"

        wrong_type_file = tmp_path / "wrong_type.json"
        wrong_type_file.write_text(json.dumps(data), encoding="utf-8")
        with pytest.raises(DatasetTypeError) as exc_info:
            load_dataset_from_path(wrong_type_file)
        assert "schema validation" in str(exc_info.value).lower()

    def test_dataset_summary_function(self) -> None:
        """Verify get_dataset_summary returns accurate statistics."""
        summary = get_dataset_summary()
        assert isinstance(summary, DatasetSummary)
        assert summary.dataset_id == "cit-public-v1"
        assert summary.institute == "Chilika Institute of Technology (fictional)"
        assert summary.total_rooms == 27
        assert summary.total_faculty == 40
        assert summary.total_student_groups == 14
        assert summary.total_courses == 62
        assert summary.total_sessions == 189
        assert summary.total_booking_requests == 25
        assert summary.total_cancellations == 1
        assert summary.total_exams == 41
        assert summary.total_room_unavailability == 2

    def test_dataset_service_class(self) -> None:
        """Verify the DatasetService OOP wrapper."""
        service = DatasetService()
        ds = service.load()
        assert ds.dataset_id == "cit-public-v1"
        summary = DatasetService.get_summary()
        assert summary.total_sessions == 189


# ===========================================================================
# 2. FastAPI API Endpoint Tests
# ===========================================================================

class TestApiEndpoints:
    """Tests covering all required HTTP endpoints."""

    def test_health_endpoint(self, client: TestClient) -> None:
        """Verify GET /health returns 200 with status ok."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_summary_endpoint(self, client: TestClient) -> None:
        """Verify GET /api/v1/dataset/summary returns 200 and exact expected counts."""
        response = client.get(f"{BASE_URL}/summary")
        assert response.status_code == 200
        data = response.json()

        assert data["dataset_id"] == "cit-public-v1"
        assert data["institute"] == "Chilika Institute of Technology (fictional)"
        assert data["total_rooms"] == 27
        assert data["total_faculty"] == 40
        assert data["total_student_groups"] == 14
        assert data["total_courses"] == 62
        assert data["total_sessions"] == 189
        assert data["total_booking_requests"] == 25
        assert data["total_cancellations"] == 1
        assert data["total_exams"] == 41
        assert data["total_room_unavailability"] == 2

    def test_rooms_endpoint(self, client: TestClient) -> None:
        """Verify GET /api/v1/dataset/rooms returns list of 27 rooms with valid schemas."""
        response = client.get(f"{BASE_URL}/rooms")
        assert response.status_code == 200
        rooms = response.json()
        assert isinstance(rooms, list)
        assert len(rooms) == 27

        first_room = rooms[0]
        assert "id" in first_room
        assert "name" in first_room
        assert "building" in first_room
        assert "type" in first_room
        assert "capacity" in first_room
        assert "features" in first_room
        assert "accessible" in first_room
        assert "allowed_uses" in first_room

    def test_single_room_lookup(self, client: TestClient) -> None:
        """Verify GET /api/v1/dataset/rooms/{room_id} returns 200 for AUD and 404 for unknown."""
        response = client.get(f"{BASE_URL}/rooms/AUD")
        assert response.status_code == 200
        assert response.json()["id"] == "AUD"
        assert response.json()["name"] == "Main Auditorium"

        not_found = client.get(f"{BASE_URL}/rooms/UNKNOWN_ROOM_999")
        assert not_found.status_code == 404

    def test_faculty_endpoint(self, client: TestClient) -> None:
        """Verify GET /api/v1/dataset/faculty returns list of 40 faculty members."""
        response = client.get(f"{BASE_URL}/faculty")
        assert response.status_code == 200
        faculty = response.json()
        assert isinstance(faculty, list)
        assert len(faculty) == 40

        first = faculty[0]
        assert "id" in first
        assert "name" in first
        assert "department" in first
        assert "max_hours_per_day" in first
        assert "unavailable" in first
        assert "preferences" in first

    def test_single_faculty_lookup(self, client: TestClient) -> None:
        """Verify GET /api/v1/dataset/faculty/{faculty_id} returns 200 for F01 and 404 for unknown."""
        response = client.get(f"{BASE_URL}/faculty/F01")
        assert response.status_code == 200
        assert response.json()["id"] == "F01"

        not_found = client.get(f"{BASE_URL}/faculty/UNKNOWN_FACULTY")
        assert not_found.status_code == 404

    def test_sessions_endpoint(self, client: TestClient) -> None:
        """Verify GET /api/v1/dataset/sessions returns list of 189 sessions."""
        response = client.get(f"{BASE_URL}/sessions")
        assert response.status_code == 200
        sessions = response.json()
        assert isinstance(sessions, list)
        assert len(sessions) == 189

        first = sessions[0]
        assert "id" in first
        assert "course_id" in first
        assert "kind" in first
        assert "groups" in first
        assert "faculty_id" in first
        assert "duration" in first

    def test_single_session_lookup(self, client: TestClient) -> None:
        """Verify GET /api/v1/dataset/sessions/{session_id} returns 200 for valid ID and 404 for unknown."""
        response = client.get(f"{BASE_URL}/sessions/MA101-AB-L1")
        assert response.status_code == 200
        assert response.json()["id"] == "MA101-AB-L1"

        not_found = client.get(f"{BASE_URL}/sessions/UNKNOWN_SESSION")
        assert not_found.status_code == 404

    def test_groups_endpoint(self, client: TestClient) -> None:
        """Verify GET /api/v1/dataset/groups returns list of 14 student groups."""
        response = client.get(f"{BASE_URL}/groups")
        assert response.status_code == 200
        groups = response.json()
        assert isinstance(groups, list)
        assert len(groups) == 14

        first = groups[0]
        assert "id" in first
        assert "name" in first
        assert "year" in first
        assert "department" in first
        assert "size" in first
        assert "needs_accessible" in first

    def test_student_groups_alias_endpoint(self, client: TestClient) -> None:
        """Verify GET /api/v1/dataset/student-groups returns the same 14 groups as /groups."""
        res_groups = client.get(f"{BASE_URL}/groups").json()
        res_student_groups = client.get(f"{BASE_URL}/student-groups").json()
        assert res_groups == res_student_groups
