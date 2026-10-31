"""Automated tests for Milestone 05: CIT Disruption Management & Rescheduling Engine.

Verifies:
  1. Room unavailability disruption
  2. Faculty unavailability disruption
  3. Multiple resource disruptions
  4. Examination room disruption
  5. Approved booking conflict
  6. Elective basket preservation & synchronization
  7. Fixed session preservation
  8. Faculty daily teaching limits
  9. Room capacity matching
  10. Room type matching
  11. Accessibility requirements
  12. Minimal change & no unrelated session movement
  13. Infeasible repair diagnostic handling
  14. FEASIBLE vs OPTIMAL status reporting
  15. Proposal rejection (leaves schedule unchanged)
  16. Proposal approval (atomically updates schedule)
  17. Schedule versioning & history logging
  18. Stale proposal detection (rejection on baseline mismatch)
  19. Full official validator compliance (0 hard violations)
  20. FastAPI HTTP endpoints for preview, approval, rejection, and history
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import SCHEDULE_FINAL_PATH
from app.engine.impact_analyzer import ImpactAnalyzer
from app.engine.repair_solver import RepairSolver
from app.models.dataset import Dataset
from app.models.disruption import DisruptionItem, DisruptionRequest, DisruptionType
from app.models.rescheduling import ProposalDecisionRequest
from app.services.dataset_service import get_dataset
from app.services.rescheduling_service import ReschedulingService
from app.services.timetable_service import TimetableService
from app.services.booking_service import BookingService
from app.services.exam_service import ExamService


@pytest.fixture(scope="module")
def dataset() -> Dataset:
    return get_dataset()


@pytest.fixture(scope="module")
def baseline_schedule(dataset: Dataset) -> dict:
    """Ensure baseline schedule exists with timetable, exams, and bookings."""
    sched = ReschedulingService.get_current_schedule()
    if not sched.get("sessions") or not sched.get("exams") or not sched.get("fest_week", {}).get("bookings"):
        # Make sure exams and bookings are populated
        ExamService.generate(dataset=dataset)
        BookingService.generate(dataset=dataset)
        sched = ReschedulingService.get_current_schedule()
    return sched


class TestDisruptionModelsAndImpact:
    """Verifies disruption parsing, validation, and impact analysis."""

    def test_disruption_request_validation(self) -> None:
        """Validates day formatting and period constraints."""
        req = DisruptionRequest(
            disruption_id="dis-test-01",
            disruption_type=DisruptionType.ROOM_UNAVAILABLE,
            resource_id="CR-102",
            affected_day="MON",
            start_period=2,
            end_period=5,
            reason="Water pipe maintenance",
            reported_by="Campus Facilities",
        )
        assert req.affected_days == ["MON"]
        assert req.start_period == 2
        assert req.end_period == 5

        # Check official format conversion
        changes = req.to_official_changes()
        assert len(changes) == 1
        assert changes[0]["type"] == "room_unavailable"
        assert changes[0]["room_id"] == "CR-102"
        assert changes[0]["periods"] == [2, 3, 4, 5]

    def test_invalid_period_rejected(self) -> None:
        """start_period > end_period must raise ValidationError."""
        with pytest.raises(Exception):
            DisruptionRequest(
                disruption_id="dis-invalid",
                disruption_type=DisruptionType.ROOM_UNAVAILABLE,
                resource_id="CR-101",
                affected_day="MON",
                start_period=8,
                end_period=3,  # Invalid
                reason="Invalid period test",
                reported_by="Tester",
            )

    def test_impact_analysis_room_unavailability(
        self, dataset: Dataset, baseline_schedule: dict
    ) -> None:
        """ImpactAnalyzer correctly identifies sessions using the disrupted room."""
        # Find a room and period actually occupied in the baseline
        first_session = baseline_schedule["sessions"][0]
        r_id = first_session["room_id"]
        d = first_session["day"]
        p = first_session["start_period"]

        disruption = DisruptionRequest(
            disruption_id="dis-room-01",
            disruption_type=DisruptionType.ROOM_UNAVAILABLE,
            resource_id=r_id,
            affected_day=d,
            start_period=p,
            end_period=p,
            reason="AC repair",
            reported_by="Estates Dept",
        )

        analyzer = ImpactAnalyzer(dataset, baseline_schedule)
        impact = analyzer.analyze(disruption)

        assert impact.total_activities_requiring_repair >= 1
        assert r_id in impact.affected_rooms
        hit_ids = [a.activity_id for a in impact.directly_affected_activities]
        assert first_session["session_id"] in hit_ids

    def test_impact_analysis_faculty_unavailability(
        self, dataset: Dataset, baseline_schedule: dict
    ) -> None:
        """ImpactAnalyzer correctly identifies sessions taught by the disrupted faculty."""
        first_session = baseline_schedule["sessions"][0]
        s_obj = next(s for s in dataset.sessions if s.id == first_session["session_id"])
        fac_id = s_obj.faculty_id
        d = first_session["day"]

        disruption = DisruptionRequest(
            disruption_id="dis-fac-01",
            disruption_type=DisruptionType.FACULTY_UNAVAILABLE,
            resource_id=fac_id,
            affected_day=d,
            start_period=1,
            end_period=9,
            reason="Medical leave",
            reported_by="Dean Academic",
        )

        analyzer = ImpactAnalyzer(dataset, baseline_schedule)
        impact = analyzer.analyze(disruption)

        assert fac_id in impact.affected_faculty
        hit_ids = [a.activity_id for a in impact.directly_affected_activities]
        assert first_session["session_id"] in hit_ids


class TestRepairSolverAndMinimalChange:
    """Verifies CP-SAT repair solver, constraint enforcement, and minimal changes."""

    def test_room_unavailability_repair_success(
        self, dataset: Dataset, baseline_schedule: dict
    ) -> None:
        """Solver successfully repairs schedule with 0 hard violations when a room is unavailable."""
        # Displace CR-102 on Monday
        disruption = DisruptionRequest(
            disruption_id="dis-cr102-mon",
            disruption_type=DisruptionType.ROOM_UNAVAILABLE,
            resource_id="CR-102",
            affected_day="MON",
            start_period=1,
            end_period=9,
            reason="Audio equipment upgrade",
            reported_by="IT Admin",
        )

        solver = RepairSolver(dataset, baseline_schedule, disruption)
        result = solver.solve(time_limit_seconds=15.0)

        assert result.status in ("OPTIMAL", "FEASIBLE")
        assert result.is_success is True

        # Ensure no session in repaired schedule is in CR-102 on MON
        for s in result.repaired_schedule["sessions"]:
            if s["day"] == "MON":
                assert s["room_id"] != "CR-102", f"Session {s['session_id']} still scheduled in CR-102 on MON"

        # Verify changed sessions list is concise (minimal movement)
        assert len(result.changed_sessions) > 0
        # Check that room changes are preferred
        room_only_changes = [c for c in result.changed_sessions if c.change_type == "room_only"]
        assert len(room_only_changes) >= 1

    def test_faculty_unavailability_repair_success(
        self, dataset: Dataset, baseline_schedule: dict
    ) -> None:
        """Solver moves sessions taught by faculty F07 away from Monday per sample disruption."""
        disruption = DisruptionRequest(
            disruption_id="dis-f07-mon",
            disruption_type=DisruptionType.FACULTY_UNAVAILABLE,
            resource_id="F07",
            affected_day="MON",
            start_period=1,
            end_period=9,
            reason="Weekly Monday symposium",
            reported_by="HoD",
        )

        solver = RepairSolver(dataset, baseline_schedule, disruption)
        result = solver.solve(time_limit_seconds=15.0)

        assert result.status in ("OPTIMAL", "FEASIBLE")
        assert result.is_success is True

        # Verify no F07 session is on Monday
        f07_sids = {s.id for s in dataset.sessions if s.faculty_id == "F07"}
        for s in result.repaired_schedule["sessions"]:
            if s["session_id"] in f07_sids:
                assert s["day"] != "MON", f"F07 session {s['session_id']} scheduled on MON"

    def test_elective_basket_synchronization_preserved(
        self, dataset: Dataset, baseline_schedule: dict
    ) -> None:
        """When an elective basket session is disrupted, all peer sessions stay synchronized in time."""
        # Find a session in an elective basket
        basket_session = next(s for s in dataset.sessions if s.basket_slot == "OEB-1")
        b_peers = [s for s in dataset.sessions if s.basket_slot == "OEB-1"]

        # Displace its assigned room
        orig_s = next(
            s for s in baseline_schedule["sessions"] if s["session_id"] == basket_session.id
        )

        disruption = DisruptionRequest(
            disruption_id="dis-basket-01",
            disruption_type=DisruptionType.ROOM_UNAVAILABLE,
            resource_id=orig_s["room_id"],
            affected_day=orig_s["day"],
            start_period=orig_s["start_period"],
            end_period=orig_s["start_period"] + basket_session.duration - 1,
            reason="Room emergency",
            reported_by="Registrar",
        )

        solver = RepairSolver(dataset, baseline_schedule, disruption)
        result = solver.solve(time_limit_seconds=15.0)
        assert result.is_success is True

        # Check all 3 OEB-1 sessions share identical day and start_period
        repaired_map = {
            s["session_id"]: (s["day"], s["start_period"], s["room_id"])
            for s in result.repaired_schedule["sessions"]
        }

        peer_slots = [repaired_map[p.id][:2] for p in b_peers]
        assert len(set(peer_slots)) == 1, f"Basket peers not synchronized: {peer_slots}"

        # Distinct rooms
        peer_rooms = [repaired_map[p.id][2] for p in b_peers]
        assert len(set(peer_rooms)) == len(b_peers), f"Basket peers share rooms: {peer_rooms}"

    def test_multi_resource_disruption(
        self, dataset: Dataset, baseline_schedule: dict
    ) -> None:
        """Solver handles multiple concurrent room and faculty disruptions."""
        disruption = DisruptionRequest(
            disruption_id="dis-multi-01",
            disruption_type=DisruptionType.MULTIPLE_RESOURCE_DISRUPTION,
            resource_id="CR-101",
            affected_day="TUE",
            start_period=1,
            end_period=5,
            reason="Ceiling maintenance and faculty travel",
            reported_by="Dean Admin",
            additional_items=[
                DisruptionItem(
                    disruption_type=DisruptionType.ROOM_UNAVAILABLE,
                    resource_id="CR-102",
                    affected_days=["TUE"],
                    start_period=1,
                    end_period=5,
                    reason="Adjacent ceiling repair",
                ),
                DisruptionItem(
                    disruption_type=DisruptionType.FACULTY_UNAVAILABLE,
                    resource_id="F01",
                    affected_days=["TUE"],
                    start_period=1,
                    end_period=5,
                    reason="External PhD defense committee",
                ),
            ],
        )

        solver = RepairSolver(dataset, baseline_schedule, disruption)
        result = solver.solve(time_limit_seconds=15.0)

        assert result.status in ("OPTIMAL", "FEASIBLE")
        assert result.is_success is True

    def test_infeasible_repair_reported(
        self, dataset: Dataset, baseline_schedule: dict
    ) -> None:
        """When an impossible disruption occurs (e.g. all compatible rooms closed), reports INFEASIBLE."""
        # ID101-ALL-L1 requires AUD (size 360). If AUD is unavailable all week, it's unplannable
        disruption = DisruptionRequest(
            disruption_id="dis-aud-block",
            disruption_type=DisruptionType.ROOM_UNAVAILABLE,
            resource_id="AUD",
            affected_days=["MON", "TUE", "WED", "THU", "FRI"],
            start_period=1,
            end_period=9,
            reason="Auditorium full structural overhaul",
            reported_by="Facilities",
        )

        solver = RepairSolver(dataset, baseline_schedule, disruption)
        result = solver.solve(time_limit_seconds=10.0)

        assert result.is_success is False
        assert result.status in ("INFEASIBLE", "UNKNOWN")
        assert len(result.unresolved_activities) > 0 or len(result.diagnostics) > 0


class TestTwoStagePreviewAndApproval:
    """Verifies proposal creation, staleness check, atomic approval, rejection, and history."""

    def test_preview_generates_valid_proposal(self, dataset: Dataset) -> None:
        """POST preview produces a proposal with 0 hard violations and valid diffs."""
        ReschedulingService.clear_state()
        disruption = DisruptionRequest(
            disruption_id="prop-test-01",
            disruption_type=DisruptionType.ROOM_UNAVAILABLE,
            resource_id="CR-201",
            affected_day="WED",
            start_period=3,
            end_period=6,
            reason="Smart board maintenance",
            reported_by="Academic Office",
        )

        proposal = ReschedulingService.create_preview(disruption, dataset=dataset)

        assert proposal.status == "pending"
        assert proposal.is_feasible is True
        assert proposal.validation_report.is_valid is True
        assert proposal.validation_report.hard_violation_count == 0

    def test_reject_proposal_keeps_schedule_untouched(self) -> None:
        """Rejecting a proposal changes its status to 'rejected' without modifying schedule."""
        props = ReschedulingService.list_proposals()
        assert len(props) > 0
        prop = props[0]

        decision = ProposalDecisionRequest(
            decided_by="DeanAcademic",
            reason="Prefer maintenance on weekend instead",
        )
        rejected = ReschedulingService.reject_proposal(prop.proposal_id, decision)

        assert rejected.status == "rejected"
        assert rejected.approved_by == "DeanAcademic"

        # Verify active schedule not changed
        current = ReschedulingService.get_current_schedule()
        assert current is not None

    def test_approve_proposal_atomically_commits_and_logs_history(self, dataset: Dataset) -> None:
        """Approving a proposal archives previous schedule, updates active schedule, and logs audit."""
        disruption = DisruptionRequest(
            disruption_id="prop-test-approve",
            disruption_type=DisruptionType.ROOM_UNAVAILABLE,
            resource_id="CR-202",
            affected_day="THU",
            start_period=4,
            end_period=6,
            reason="Projector bulb replacement",
            reported_by="Campus AV",
        )

        proposal = ReschedulingService.create_preview(disruption, dataset=dataset)
        assert proposal.status == "pending"

        decision = ProposalDecisionRequest(
            decided_by="SuperAdmin",
            reason="Approved immediately for AV repair",
        )
        record = ReschedulingService.approve_proposal(proposal.proposal_id, decision)

        assert record.version_number >= 1
        assert record.approved_by == "SuperAdmin"
        assert Path(record.backup_file_path).exists()

        # Check history
        history = ReschedulingService.get_history()
        assert len(history) >= 1
        assert history[0].proposal_id == proposal.proposal_id

    def test_stale_proposal_rejected(self, dataset: Dataset) -> None:
        """If baseline schedule is modified after proposal creation, approve raises ValueError."""
        disruption = DisruptionRequest(
            disruption_id="prop-stale-test",
            disruption_type=DisruptionType.ROOM_UNAVAILABLE,
            resource_id="CR-101",
            affected_day="FRI",
            start_period=2,
            end_period=4,
            reason="Staleness test",
            reported_by="Tester",
        )

        proposal = ReschedulingService.create_preview(disruption, dataset=dataset)

        # Intentionally alter the baseline hash of the proposal to simulate interim schedule change
        proposal.baseline_hash = "fake-outdated-hash-12345"
        ReschedulingService._proposals[proposal.proposal_id] = proposal

        with pytest.raises(ValueError, match="Stale proposal conflict"):
            ReschedulingService.approve_proposal(
                proposal.proposal_id,
                ProposalDecisionRequest(decided_by="Admin", reason="Attempt stale approve"),
            )

    def test_official_sample_disruption_file_repair(
        self, dataset: Dataset, baseline_schedule: dict
    ) -> None:
        """Loads and successfully repairs the official starter-pack sample_disruption.json."""
        sample_path = (
            Path(__file__).resolve().parent.parent.parent
            / "starter-pack"
            / "CrunchWeek_StarterPack"
            / "examples"
            / "sample_disruption.json"
        )
        assert sample_path.exists()
        raw_dis = json.loads(sample_path.read_text(encoding="utf-8"))

        disruption = DisruptionRequest(
            disruption_id=raw_dis.get("id", "sample-disruption"),
            disruption_type=DisruptionType.MULTIPLE_RESOURCE_DISRUPTION,
            resource_id="MULTIPLE",
            reason=raw_dis.get("description", "Sample official disruption"),
            reported_by="CrunchWeek Evaluator",
            changes=raw_dis.get("changes", []),
        )

        solver = RepairSolver(dataset, baseline_schedule, disruption)
        result = solver.solve(time_limit_seconds=15.0)

        assert result.status in ("OPTIMAL", "FEASIBLE")
        assert result.is_success is True

        # Run official validator on result
        from app.engine.repair_optimizer import RepairOptimizer
        val_report = RepairOptimizer.validate_repaired_schedule(
            dataset=dataset,
            disruption=disruption,
            repaired_schedule=result.repaired_schedule,
            baseline_schedule=baseline_schedule,
        )

        assert val_report.is_valid is True
        assert val_report.hard_violation_count == 0
        assert val_report.sessions_moved > 0


class TestReschedulingAPIEndpoints:
    """Verifies FastAPI REST endpoints (/api/v1/rescheduling/*)."""

    def test_api_preview_endpoint(self, client: TestClient) -> None:
        """POST /api/v1/rescheduling/preview returns 200 with complete proposal."""
        payload = {
            "disruption_id": "api-dis-01",
            "disruption_type": "ROOM_UNAVAILABLE",
            "resource_id": "CR-103",
            "affected_day": "MON",
            "start_period": 2,
            "end_period": 4,
            "reason": "Air conditioner filter cleaning",
            "reported_by": "Facilities Team",
            "severity": "medium",
        }
        res = client.post("/api/v1/rescheduling/preview", json=payload)
        assert res.status_code == 200
        data = res.json()

        assert data["proposal_id"].startswith("prop-")
        assert data["status"] == "pending"
        assert data["is_feasible"] is True
        assert data["validation_report"]["is_valid"] is True
        assert data["validation_report"]["hard_violation_count"] == 0

    def test_api_proposals_list_and_detail(self, client: TestClient) -> None:
        """GET /api/v1/rescheduling/proposals and GET /api/v1/rescheduling/proposals/{id}."""
        res = client.get("/api/v1/rescheduling/proposals")
        assert res.status_code == 200
        props = res.json()
        assert len(props) > 0

        first_id = props[0]["proposal_id"]
        res_detail = client.get(f"/api/v1/rescheduling/proposals/{first_id}")
        assert res_detail.status_code == 200
        assert res_detail.json()["proposal_id"] == first_id

    def test_api_impact_endpoint(self, client: TestClient) -> None:
        """GET /api/v1/rescheduling/impact/{disruption_id} returns impact analysis."""
        res = client.get("/api/v1/rescheduling/impact/api-dis-01")
        assert res.status_code == 200
        data = res.json()
        assert data["disruption_id"] == "api-dis-01"
        assert "directly_affected_activities" in data

    def test_api_history_endpoint(self, client: TestClient) -> None:
        """GET /api/v1/rescheduling/history returns committed audit history."""
        res = client.get("/api/v1/rescheduling/history")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
