"""Rescheduling service managing disruption lifecycle, proposals, atomic versioning, and validation."""

from __future__ import annotations

import copy
import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import (
    EXPORTS_DIR,
    SCHEDULE_DRAFT_PATH,
    SCHEDULE_FINAL_PATH,
    TIMETABLE_DRAFT_PATH,
)
from app.engine.impact_analyzer import ImpactAnalyzer
from app.engine.repair_optimizer import RepairOptimizer
from app.engine.repair_solver import RepairSolver
from app.models.dataset import Dataset
from app.models.disruption import DisruptionRequest
from app.models.rescheduling import (
    ImpactReport,
    ProposalDecisionRequest,
    RepairProposal,
    ReschedulingValidationReport,
    ScheduleVersionRecord,
)
from app.services.dataset_service import get_dataset
from app.services.timetable_service import TimetableService

logger = logging.getLogger(__name__)

# Directory paths for versioning and proposals
HISTORY_DIR = EXPORTS_DIR / "history"
PROPOSALS_DIR = EXPORTS_DIR / "proposals"
AUDIT_LOG_PATH = HISTORY_DIR / "audit_log.json"


class ReschedulingService:
    """Coordinates disruption previews, pending proposals, atomic commits, and schedule versioning."""

    _proposals: dict[str, RepairProposal] = {}
    _impacts: dict[str, ImpactReport] = {}
    _version_history: list[ScheduleVersionRecord] = []

    @classmethod
    def _ensure_dirs(cls) -> None:
        HISTORY_DIR.mkdir(parents=True, exist_ok=True)
        PROPOSALS_DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    def _compute_schedule_hash(cls, schedule_dict: dict[str, Any]) -> str:
        """Calculate deterministic SHA256 hash of schedule payload."""
        content = json.dumps(schedule_dict, sort_keys=True)
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @classmethod
    def get_current_schedule(cls) -> dict[str, Any]:
        """Load the active schedule from disk or generate a baseline if not yet present."""
        cls._ensure_dirs()
        if SCHEDULE_FINAL_PATH.exists():
            try:
                return json.loads(SCHEDULE_FINAL_PATH.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Error reading %s: %s", SCHEDULE_FINAL_PATH, exc)

        if SCHEDULE_DRAFT_PATH.exists():
            try:
                return json.loads(SCHEDULE_DRAFT_PATH.read_text(encoding="utf-8"))
            except Exception:
                pass

        # Fallback: trigger timetable generation to create a baseline
        logger.info("No active schedule found on disk. Generating baseline timetable...")
        ds = get_dataset()
        tt_res = TimetableService.generate(dataset=ds)
        combined = {
            "team": tt_res.schedule.team,
            "dataset_id": ds.dataset_id,
            "sessions": [s.model_dump() for s in tt_res.schedule.sessions],
            "fest_week": {"bookings": [], "session_overrides": []},
            "exams": [],
        }
        SCHEDULE_FINAL_PATH.write_text(json.dumps(combined, indent=2), encoding="utf-8")
        return combined

    @classmethod
    def create_preview(
        cls, disruption: DisruptionRequest, dataset: Dataset | None = None
    ) -> RepairProposal:
        """Stage A: Ingest disruption, compute impact, formulate CP-SAT repair, and generate proposal."""
        cls._ensure_dirs()
        ds = dataset or get_dataset()
        current_sched = cls.get_current_schedule()
        baseline_hash = cls._compute_schedule_hash(current_sched)

        # 1. Impact Analysis
        analyzer = ImpactAnalyzer(ds, current_sched)
        impact = analyzer.analyze(disruption)
        cls._impacts[disruption.disruption_id] = impact

        # 2. Run CP-SAT Repair Solver
        solver = RepairSolver(ds, current_sched, disruption)
        result = solver.solve()

        # 3. Full Official Validation
        val_report: ReschedulingValidationReport
        if result.is_success and result.repaired_schedule:
            val_report = RepairOptimizer.validate_repaired_schedule(
                dataset=ds,
                disruption=disruption,
                repaired_schedule=result.repaired_schedule,
                baseline_schedule=current_sched,
            )
        else:
            val_report = ReschedulingValidationReport(
                is_valid=False,
                hard_violation_count=len(result.unresolved_activities),
                hard_violations=[
                    {"rule": "REPAIR_FAILED", "where": "solver", "detail": diag}
                    for diag in result.diagnostics
                ],
                soft_penalty=999,
            )

        proposal_id = f"prop-{disruption.disruption_id}-{int(datetime.now(timezone.utc).timestamp())}"
        now_iso = datetime.now(timezone.utc).isoformat()

        proposal = RepairProposal(
            proposal_id=proposal_id,
            disruption_id=disruption.disruption_id,
            baseline_schedule_id=current_sched.get("dataset_id", "cit-public-v1"),
            baseline_hash=baseline_hash,
            status="pending",
            solver_status=result.status,
            is_feasible=result.is_success,
            solve_time_seconds=round(result.solve_time_seconds, 3),
            created_at=now_iso,
            created_by=disruption.reported_by,
            changed_sessions=result.changed_sessions,
            changed_exams=result.changed_exams,
            changed_bookings=result.changed_bookings,
            unresolved_activities=result.unresolved_activities,
            validation_report=val_report,
            proposed_schedule=result.repaired_schedule,
        )

        # Persist proposal draft
        cls._proposals[proposal_id] = proposal
        p_path = PROPOSALS_DIR / f"{proposal_id}.json"
        p_path.write_text(json.dumps(proposal.model_dump(), indent=2), encoding="utf-8")

        return proposal

    @classmethod
    def get_impact_analysis(
        cls, disruption_id: str, dataset: Dataset | None = None
    ) -> ImpactReport | None:
        """Retrieve stored impact analysis or compute for disruption if cached."""
        return cls._impacts.get(disruption_id)

    @classmethod
    def list_proposals(cls) -> list[RepairProposal]:
        """List all repair proposals in reverse chronological order."""
        cls._ensure_dirs()
        # Load from disk if in-memory empty
        if not cls._proposals:
            for p_file in sorted(PROPOSALS_DIR.glob("*.json"), reverse=True):
                try:
                    data = json.loads(p_file.read_text(encoding="utf-8"))
                    prop = RepairProposal.model_validate(data)
                    cls._proposals[prop.proposal_id] = prop
                except Exception:
                    pass

        return sorted(
            cls._proposals.values(), key=lambda p: p.created_at, reverse=True
        )

    @classmethod
    def get_proposal(cls, proposal_id: str) -> RepairProposal | None:
        """Retrieve specific proposal details."""
        if proposal_id in cls._proposals:
            return cls._proposals[proposal_id]

        p_path = PROPOSALS_DIR / f"{proposal_id}.json"
        if p_path.exists():
            try:
                data = json.loads(p_path.read_text(encoding="utf-8"))
                prop = RepairProposal.model_validate(data)
                cls._proposals[prop.proposal_id] = prop
                return prop
            except Exception:
                pass
        return None

    @classmethod
    def approve_proposal(
        cls, proposal_id: str, decision: ProposalDecisionRequest
    ) -> ScheduleVersionRecord:
        """Stage B: Verify schedule integrity (staleness check), archive previous version, and commit new schedule."""
        cls._ensure_dirs()
        proposal = cls.get_proposal(proposal_id)
        if proposal is None:
            raise ValueError(f"Proposal '{proposal_id}' not found.")

        if proposal.status != "pending":
            raise ValueError(f"Proposal '{proposal_id}' has already been {proposal.status}.")

        current_sched = cls.get_current_schedule()
        current_hash = cls._compute_schedule_hash(current_sched)

        # STALENESS CHECK: Ensure baseline hasn't been modified since proposal creation
        if current_hash != proposal.baseline_hash:
            proposal.status = "stale"
            p_path = PROPOSALS_DIR / f"{proposal_id}.json"
            p_path.write_text(json.dumps(proposal.model_dump(), indent=2), encoding="utf-8")
            raise ValueError(
                "Stale proposal conflict: The active campus schedule was modified after this proposal was generated. "
                "Please regenerate the repair proposal against the latest schedule."
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        next_version = len(cls._version_history) + 1

        # 1. Archive current schedule before replacing
        backup_filename = f"schedule_v{next_version}.json"
        backup_path = HISTORY_DIR / backup_filename
        backup_path.write_text(json.dumps(current_sched, indent=2), encoding="utf-8")

        # 2. Atomically write repaired schedule to active files
        repaired_dict = proposal.proposed_schedule
        tmp_final = SCHEDULE_FINAL_PATH.with_suffix(".tmp")
        tmp_final.write_text(json.dumps(repaired_dict, indent=2), encoding="utf-8")
        tmp_final.replace(SCHEDULE_FINAL_PATH)

        SCHEDULE_DRAFT_PATH.write_text(json.dumps(repaired_dict, indent=2), encoding="utf-8")

        # Also update timetable draft sessions
        if "sessions" in repaired_dict:
            tt_payload = {
                "team": repaired_dict.get("team", "OfficialCITTeam"),
                "dataset_id": repaired_dict.get("dataset_id", "cit-public-v1"),
                "sessions": repaired_dict["sessions"],
            }
            TIMETABLE_DRAFT_PATH.write_text(json.dumps(tt_payload, indent=2), encoding="utf-8")

        # 3. Update proposal state
        proposal.status = "approved"
        proposal.approved_by = decision.decided_by
        proposal.decided_at = now_iso
        proposal.decision_reason = decision.reason

        p_path = PROPOSALS_DIR / f"{proposal_id}.json"
        p_path.write_text(json.dumps(proposal.model_dump(), indent=2), encoding="utf-8")

        # 4. Record audit history
        record = ScheduleVersionRecord(
            version_id=f"v{next_version}",
            version_number=next_version,
            disruption_id=proposal.disruption_id,
            proposal_id=proposal_id,
            approved_by=decision.decided_by,
            timestamp=now_iso,
            sessions_moved_count=len(proposal.changed_sessions),
            hard_violation_count=proposal.validation_report.hard_violation_count,
            soft_penalty=proposal.validation_report.soft_penalty,
            backup_file_path=str(backup_path),
            reason=decision.reason or f"Approved repair for disruption {proposal.disruption_id}",
        )

        cls._version_history.append(record)
        cls._append_audit_log(record)

        logger.info(
            "Proposal %s successfully approved by %s. Active schedule updated to Version %d.",
            proposal_id,
            decision.decided_by,
            next_version,
        )
        return record

    @classmethod
    def reject_proposal(
        cls, proposal_id: str, decision: ProposalDecisionRequest
    ) -> RepairProposal:
        """Reject proposal without modifying the active schedule."""
        proposal = cls.get_proposal(proposal_id)
        if proposal is None:
            raise ValueError(f"Proposal '{proposal_id}' not found.")

        if proposal.status != "pending":
            raise ValueError(f"Proposal '{proposal_id}' is already {proposal.status}.")

        now_iso = datetime.now(timezone.utc).isoformat()
        proposal.status = "rejected"
        proposal.approved_by = decision.decided_by
        proposal.decided_at = now_iso
        proposal.decision_reason = decision.reason

        p_path = PROPOSALS_DIR / f"{proposal_id}.json"
        p_path.write_text(json.dumps(proposal.model_dump(), indent=2), encoding="utf-8")

        logger.info(
            "Proposal %s rejected by %s (Reason: %s). Schedule remains unchanged.",
            proposal_id,
            decision.decided_by,
            decision.reason,
        )
        return proposal

    @classmethod
    def get_history(cls) -> list[ScheduleVersionRecord]:
        """Return history of committed schedule revisions."""
        cls._ensure_dirs()
        if not cls._version_history and AUDIT_LOG_PATH.exists():
            try:
                entries = json.loads(AUDIT_LOG_PATH.read_text(encoding="utf-8"))
                cls._version_history = [ScheduleVersionRecord.model_validate(e) for e in entries]
            except Exception:
                pass
        return sorted(cls._version_history, key=lambda v: v.version_number, reverse=True)

    @classmethod
    def _append_audit_log(cls, record: ScheduleVersionRecord) -> None:
        """Append record to audit log JSON."""
        try:
            entries: list[dict[str, Any]] = []
            if AUDIT_LOG_PATH.exists():
                try:
                    entries = json.loads(AUDIT_LOG_PATH.read_text(encoding="utf-8"))
                except Exception:
                    entries = []
            entries.append(record.model_dump())
            AUDIT_LOG_PATH.write_text(json.dumps(entries, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.error("Failed to append to audit log: %s", exc)

    @classmethod
    def clear_state(cls) -> None:
        """Clear memory cache (primarily used in unit tests)."""
        cls._proposals.clear()
        cls._impacts.clear()
        cls._version_history.clear()

