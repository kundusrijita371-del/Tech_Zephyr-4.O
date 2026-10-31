"""Tests for Examination API endpoints.

Covers:
- POST /api/v1/exams/generate
- GET /api/v1/exams
- GET /api/v1/exams/validation
- Draft exports to exports/exams_draft.json and exports/schedule_draft.json
"""

from __future__ import annotations

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import EXAMS_DRAFT_PATH, SCHEDULE_DRAFT_PATH
from app.main import app
from app.services.exam_service import ExamService


@pytest.fixture(autouse=True)
def clean_exam_service_state():
    ExamService.clear_state()
    yield
    ExamService.clear_state()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestExamAPI:
    def test_get_exams_404_when_none_generated(self, client: TestClient) -> None:
        # If files exist on disk, remove temporarily or expect either 404 or loaded from draft
        if EXAMS_DRAFT_PATH.exists():
            EXAMS_DRAFT_PATH.unlink()
        response = client.get("/api/v1/exams")
        assert response.status_code == 404
        assert "No exam schedule generated yet" in response.json()["detail"]

    def test_get_validation_404_when_none_generated(self, client: TestClient) -> None:
        if EXAMS_DRAFT_PATH.exists():
            EXAMS_DRAFT_PATH.unlink()
        response = client.get("/api/v1/exams/validation")
        assert response.status_code == 404

    def test_generate_exams_success(self, client: TestClient) -> None:
        payload = {
            "team_name": "OfficialCITTeam",
            "time_limit_seconds": 30.0,
            "num_workers": 8,
            "optimize_soft": True,
        }
        response = client.post("/api/v1/exams/generate", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert "schedule" in data
        assert "metadata" in data
        assert "violations" in data

        schedule = data["schedule"]
        assert schedule["team"] == "OfficialCITTeam"
        assert schedule["dataset_id"] == "cit-public-v1"
        assert len(schedule["exams"]) == 41

        metadata = data["metadata"]
        assert metadata["solver_status"] in ("OPTIMAL", "FEASIBLE")
        assert metadata["total_exams"] == 41
        assert metadata["scheduled_exams"] == 41
        assert metadata["hard_violation_count"] == 0
        assert metadata["soft_penalty"] == 0
        assert len(data["violations"]) == 0

        # Verify export files exist
        assert EXAMS_DRAFT_PATH.exists()
        assert SCHEDULE_DRAFT_PATH.exists()

        sched_disk = json.loads(SCHEDULE_DRAFT_PATH.read_text(encoding="utf-8"))
        assert "exams" in sched_disk
        assert len(sched_disk["exams"]) == 41

    def test_get_latest_exams_after_generation(self, client: TestClient) -> None:
        # First generate
        gen_res = client.post("/api/v1/exams/generate", json={"team_name": "CachedTeam"})
        assert gen_res.status_code == 200

        # Then fetch
        get_res = client.get("/api/v1/exams")
        assert get_res.status_code == 200
        data = get_res.json()
        assert len(data["schedule"]["exams"]) == 41
        assert data["metadata"]["hard_violation_count"] == 0

    def test_get_validation_endpoint(self, client: TestClient) -> None:
        # First generate
        gen_res = client.post("/api/v1/exams/generate")
        assert gen_res.status_code == 200

        # Then check validation endpoint
        val_res = client.get("/api/v1/exams/validation")
        assert val_res.status_code == 200
        val_data = val_res.json()
        assert val_data["is_valid"] is True
        assert val_data["hard_violation_count"] == 0
        assert val_data["hard_violations"] == []
        assert val_data["soft_penalty"] == 0

