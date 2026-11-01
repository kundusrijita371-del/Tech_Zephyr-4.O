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

    def test_faculty_timetable_filtering(self, client: TestClient) -> None:
        """GET /api/v1/timetable?faculty_id=F01 filters strictly to that faculty's assigned sessions."""
        # 1. Query with faculty_id param
        res = client.get("/api/v1/timetable?faculty_id=F01")
        assert res.status_code == 200
        data = res.json()
        f01_sessions = data["schedule"]["sessions"]

        # F01 in CSE has 7 sessions in cit_public dataset
        assert len(f01_sessions) == 7
        for s in f01_sessions:
            assert s["faculty_id"] == "F01"
            assert "course_id" in s
            assert "groups" in s
            assert "kind" in s
            assert "duration" in s
            assert s["day"] in ("MON", "TUE", "WED", "THU", "FRI")
            assert 1 <= s["start_period"] <= 9

        # 2. Query dedicated faculty route
        res_fac = client.get("/api/v1/timetable/faculty/F01")
        assert res_fac.status_code == 200
        assert len(res_fac.json()["schedule"]["sessions"]) == 7

        # 3. Workload rule H12 verification: max 4 hours per day
        daily_hours: dict[str, int] = {}
        for s in f01_sessions:
            day = s["day"]
            dur = s.get("duration", 1) or 1
            daily_hours[day] = daily_hours.get(day, 0) + dur
            assert daily_hours[day] <= 4, f"Faculty F01 exceeded 4h limit on {day}: {daily_hours[day]} hours"

    def test_empty_timetable_validation_state(self, client: TestClient) -> None:
        """A schedule with zero assigned sessions must NOT be presented as valid."""
        from app.models.timetable import TimetableSchedule
        from app.services.dataset_service import get_dataset
        from app.services.validation_service import TimetableValidator

        ds = get_dataset()
        empty_schedule = TimetableSchedule(team="Test", dataset_id=ds.dataset_id, sessions=[])
        val = TimetableValidator.validate_schedule(ds, empty_schedule)

        assert val.is_valid is False
        assert val.sessions_checked == 0
        assert val.total_sessions == len(ds.sessions)
        assert val.hard_violation_count == len(ds.sessions)  # All 189 sessions unassigned (H1)

    def test_infeasible_status_handling(self, client: TestClient, monkeypatch) -> None:
        """When an invalid schedule exists, solver status must report INFEASIBLE, not FEASIBLE."""
        from app.models.timetable import TimetableSchedule, TimetableSessionAssignment
        from app.services.dataset_service import get_dataset

        ds = get_dataset()
        # Schedule only 1 session => 188 missing sessions
        invalid_schedule = TimetableSchedule(
            team="Test",
            dataset_id=ds.dataset_id,
            sessions=[
                TimetableSessionAssignment(
                    session_id=ds.sessions[0].id,
                    day="MON",
                    start_period=1,
                    room_id=ds.rooms[0].id,
                )
            ],
        )

        original_text = TIMETABLE_DRAFT_PATH.read_text(encoding="utf-8") if TIMETABLE_DRAFT_PATH.exists() else None
        try:
            TIMETABLE_DRAFT_PATH.parent.mkdir(parents=True, exist_ok=True)
            TIMETABLE_DRAFT_PATH.write_text(invalid_schedule.model_dump_json(), encoding="utf-8")
            TimetableService.clear_state()

            latest = TimetableService.get_latest()
            assert latest is not None
            assert latest.metadata.solver_status == "INFEASIBLE"
            assert latest.metadata.hard_violation_count > 0
        finally:
            TimetableService.clear_state()
            if original_text is not None:
                TIMETABLE_DRAFT_PATH.write_text(original_text, encoding="utf-8")
            elif TIMETABLE_DRAFT_PATH.exists():
                TIMETABLE_DRAFT_PATH.unlink()

    def test_unknown_solver_status_never_successful(self, client: TestClient, monkeypatch) -> None:
        """Solver status UNKNOWN must never be treated as successful."""
        from app.engine.timetable_solver import SolverResult

        # Mock solver returning UNKNOWN status
        fake_unknown = SolverResult(
            status="UNKNOWN",
            is_success=False,
            solve_time_seconds=30.0,
            diagnostics=["Search aborted without finding feasible solution"],
        )

        from app.engine.timetable_solver import TimetableSolver
        monkeypatch.setattr(TimetableSolver, "solve", lambda self, **kwargs: fake_unknown)

        res = client.post("/api/v1/timetable/generate", json={"time_limit_seconds": 1.0})
        # Must be rejected with HTTP 422 Unprocessable Entity
        assert res.status_code == 422
        err_data = res.json()
        assert "CP-SAT solver returned UNKNOWN" in err_data["detail"]["message"]
        assert err_data["detail"]["metadata"]["solver_status"] == "UNKNOWN"


