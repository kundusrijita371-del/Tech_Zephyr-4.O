"""Exam service coordinating solver execution, memory caching, export, and validation."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.config import (
    EXAMS_DRAFT_PATH,
    EXPORTS_DIR,
    SCHEDULE_DRAFT_PATH,
    SCHEDULE_FINAL_PATH,
    TIMETABLE_DRAFT_PATH,
)
from app.engine.exam_solver import ExamSolver
from app.models.dataset import Dataset
from app.models.exam import (
    ExamAssignmentItem,
    ExamResponse,
    ExamSchedule,
    ExamSolverMetadata,
    ExamValidationResponse,
    GenerateExamRequest,
)
from app.services.dataset_service import get_dataset
from app.services.validation_service import ExamValidator

logger = logging.getLogger(__name__)


class ExamService:
    """Singleton service maintaining latest exam schedule state and export management."""

    _latest_response: ExamResponse | None = None

    @classmethod
    def generate(
        cls,
        request: GenerateExamRequest | None = None,
        dataset: Dataset | None = None,
    ) -> ExamResponse:
        """Run the CP-SAT engine to generate a valid midsem examination schedule."""
        req = request or GenerateExamRequest()
        ds = dataset or get_dataset()

        solver = ExamSolver(
            dataset=ds,
            team_name=req.team_name,
            time_limit_seconds=req.time_limit_seconds,
            num_workers=req.num_workers,
            optimize_soft=req.optimize_soft,
        )
        schedule, metadata, violations = solver.solve()

        response = ExamResponse(
            schedule=schedule,
            metadata=metadata,
            violations=violations,
        )
        cls._latest_response = response

        # If feasible or optimal, export both exams_draft.json and merge into schedule_draft.json
        if metadata.solver_status in ("OPTIMAL", "FEASIBLE"):
            cls._export_draft(schedule)

        return response

    @classmethod
    def get_latest(cls) -> ExamResponse | None:
        """Retrieve the most recently generated exam schedule in memory or from export file."""
        if cls._latest_response is not None:
            return cls._latest_response

        # Attempt to recover from disk if previously exported
        if EXAMS_DRAFT_PATH.exists():
            try:
                raw = json.loads(EXAMS_DRAFT_PATH.read_text(encoding="utf-8"))
                schedule = ExamSchedule.model_validate(raw)
                ds = get_dataset()
                val = ExamValidator.validate_schedule(ds, schedule)

                hard_by_rule: dict[str, int] = {}
                for v in val.hard_violations:
                    r = v.get("rule", "UNKNOWN")
                    hard_by_rule[r] = hard_by_rule.get(r, 0) + 1

                rooms_used_set: set[str] = set()
                total_capacity = 0
                total_students = 0
                for item in schedule.exams:
                    rooms_used_set.update(item.rooms)
                    total_capacity += item.effective_capacity
                    total_students += item.size

                metadata = ExamSolverMetadata(
                    solver_status="OPTIMAL" if val.is_valid else "FEASIBLE",
                    solve_time_seconds=0.0,
                    total_exams=len(ds.exams),
                    scheduled_exams=len(schedule.exams),
                    hard_violation_count=val.hard_violation_count,
                    soft_penalty=val.soft_penalty,
                    objective_value=None,
                    hard_by_rule=hard_by_rule,
                    rooms_used_count=len(rooms_used_set),
                    total_capacity_provided=total_capacity,
                    total_students_seated=total_students,
                )
                cls._latest_response = ExamResponse(
                    schedule=schedule,
                    metadata=metadata,
                    violations=val.hard_violations,
                )
                return cls._latest_response
            except Exception as exc:
                logger.warning("Could not restore exam schedule from %s: %s", EXAMS_DRAFT_PATH, exc)

        return None

    @classmethod
    def get_validation(cls) -> ExamValidationResponse | None:
        """Validate the latest exam schedule against official check_exams."""
        latest = cls.get_latest()
        if latest is None:
            return None

        ds = get_dataset()
        return ExamValidator.validate_schedule(ds, latest.schedule)

    @classmethod
    def clear_state(cls) -> None:
        """Reset internal state (primarily used in testing)."""
        cls._latest_response = None

    @classmethod
    def _export_draft(cls, schedule: ExamSchedule) -> None:
        """Persist exams draft to exports/exams_draft.json and merge into exports/schedule_draft.json."""
        try:
            EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

            # 1. Write dedicated exams_draft.json
            exams_payload = schedule.model_dump()
            EXAMS_DRAFT_PATH.write_text(
                json.dumps(exams_payload, indent=2), encoding="utf-8"
            )
            logger.info("Exported exams draft to %s", EXAMS_DRAFT_PATH)

            # 2. Merge into combined schedule_draft.json preserving existing sessions and bookings
            combined_schedule: dict[str, Any] = {
                "team": schedule.team,
                "dataset_id": schedule.dataset_id,
                "sessions": [],
                "fest_week": {
                    "bookings": [],
                    "session_overrides": [],
                },
                "exams": [],
            }

            if SCHEDULE_FINAL_PATH.exists():
                try:
                    existing = json.loads(SCHEDULE_FINAL_PATH.read_text(encoding="utf-8"))
                    if isinstance(existing, dict) and len(existing.get("sessions", [])) == 189:
                        combined_schedule["team"] = existing.get("team", schedule.team)
                        combined_schedule["dataset_id"] = existing.get("dataset_id", schedule.dataset_id)
                        combined_schedule["sessions"] = existing.get("sessions", [])
                        combined_schedule["fest_week"] = existing.get("fest_week", {"bookings": [], "session_overrides": []})
                except Exception:
                    pass

            if not combined_schedule.get("sessions") and SCHEDULE_DRAFT_PATH.exists():
                try:
                    combined_schedule = json.loads(
                        SCHEDULE_DRAFT_PATH.read_text(encoding="utf-8")
                    )
                except Exception:
                    pass
            elif not combined_schedule.get("sessions") and TIMETABLE_DRAFT_PATH.exists():
                try:
                    tt_raw = json.loads(
                        TIMETABLE_DRAFT_PATH.read_text(encoding="utf-8")
                    )
                    combined_schedule["sessions"] = tt_raw.get("sessions", [])
                except Exception:
                    pass

            if not combined_schedule.get("sessions"):
                from app.services.timetable_service import TimetableService
                tt_latest = TimetableService.get_latest()
                if tt_latest and tt_latest.schedule.sessions and len(tt_latest.schedule.sessions) == 189:
                    combined_schedule["sessions"] = [s.model_dump() for s in tt_latest.schedule.sessions]
                else:
                    tt_gen = TimetableService.generate(dataset=get_dataset())
                    combined_schedule["sessions"] = [s.model_dump() for s in tt_gen.schedule.sessions]

            # Update exams block matching the official starter pack format
            combined_schedule["exams"] = [
                {
                    "exam_id": item.exam_id,
                    "day": item.day,
                    "session": item.session,
                    "rooms": item.rooms,
                }
                for item in schedule.exams
            ]
            combined_schedule["team"] = schedule.team
            combined_schedule["dataset_id"] = schedule.dataset_id

            SCHEDULE_DRAFT_PATH.write_text(
                json.dumps(combined_schedule, indent=2), encoding="utf-8"
            )
            logger.info("Merged exams into schedule draft at %s", SCHEDULE_DRAFT_PATH)

        except Exception as exc:
            logger.error("Failed to export exam schedule draft: %s", exc)

