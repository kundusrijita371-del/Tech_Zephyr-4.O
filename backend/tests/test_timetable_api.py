"""Tests for Timetable API routes (/api/v1/timetable/*)."""

from __future__ import annotations

import json
from pathlib import Path
from fastapi.testclient import TestClient

from app.config import TIMETABLE_DRAFT_PATH
from app.services.timetable_service import TimetableService


class TestTimetableApi:
    """Verifies HTTP endpoints for timetable generation, retrieval, and validation."""

    def test_generate_timetable_endpoint(self, client: TestClient) -> None:
        """POST /api/v1/timetable/generate generates a full clash-free timetable."""
        payload = {
            "team_name": "TestHackerTeam",
            "time_limit_seconds": 30.0,
            "num_workers": 8,
            "optimize_soft": True,
        }
        res = client.post("/api/v1/timetable/generate", json=payload)
        assert res.status_code == 200
        data = res.json()

        assert "schedule" in data
        assert "metadata" in data
        assert data["schedule"]["team"] == "TestHackerTeam"
        assert data["schedule"]["dataset_id"] == "cit-public-v1"
        assert len(data["schedule"]["sessions"]) == 189

        metadata = data["metadata"]
        assert metadata["solver_status"] in ("OPTIMAL", "FEASIBLE")
        assert metadata["scheduled_sessions"] == 189
        assert metadata["total_sessions"] == 189
        assert metadata["hard_violation_count"] == 0
        assert data["violations"] == []

        # Verify export file was generated
        assert TIMETABLE_DRAFT_PATH.exists()
        saved = json.loads(TIMETABLE_DRAFT_PATH.read_text(encoding="utf-8"))
        assert saved["team"] == "TestHackerTeam"
        assert len(saved["sessions"]) == 189

    def test_get_latest_timetable_endpoint(self, client: TestClient) -> None:
        """GET /api/v1/timetable retrieves the generated timetable."""
        res = client.get("/api/v1/timetable")
        assert res.status_code == 200
        data = res.json()
        assert len(data["schedule"]["sessions"]) == 189
        assert data["metadata"]["hard_violation_count"] == 0

    def test_get_timetable_validation_endpoint(self, client: TestClient) -> None:
        """GET /api/v1/timetable/validation evaluates the schedule against official rules."""
        res = client.get("/api/v1/timetable/validation")
        assert res.status_code == 200
        data = res.json()
        assert data["is_valid"] is True
        assert data["hard_violation_count"] == 0
        assert data["hard_violations"] == []
        assert data["soft_penalty"] > 0
        assert "S1" in data["soft_penalties"]

    def test_get_404_when_no_timetable(self, client: TestClient, monkeypatch) -> None:
        """GET /api/v1/timetable must return 404 when no timetable has been generated or exported."""
        # Temporarily clear in-memory state and mock missing export file
        TimetableService.clear_state()
        monkeypatch.setattr(Path, "exists", lambda self: False)

        res = client.get("/api/v1/timetable")
        assert res.status_code == 404
        assert "No timetable generated yet" in res.json()["detail"]

        res_val = client.get("/api/v1/timetable/validation")
        assert res_val.status_code == 404
        assert "No timetable generated yet" in res_val.json()["detail"]

