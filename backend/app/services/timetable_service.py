"""Timetable service coordinating solver execution, memory state, export, and validation."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from app.config import (
    EXAMS_DRAFT_PATH,
    EXPORTS_DIR,
    SCHEDULE_DRAFT_PATH,
    TIMETABLE_DRAFT_PATH,
)
from app.engine.timetable_solver import SolverResult, TimetableSolver
from app.models.dataset import Dataset
from app.models.timetable import (
    GenerateTimetableRequest,
    TimetableResponse,
    TimetableSchedule,
    TimetableSolverMetadata,
    TimetableValidationResponse,
)
from app.services.dataset_service import get_dataset
from app.services.validation_service import TimetableValidator

logger = logging.getLogger(__name__)


class TimetableService:
    """Singleton service maintaining latest timetable state and export management."""

    _latest_result: SolverResult | None = None
    _latest_response: TimetableResponse | None = None

    @classmethod
    def generate(
        cls,
        request: GenerateTimetableRequest | None = None,
        dataset: Dataset | None = None,
    ) -> TimetableResponse:
        """Run the CP-SAT engine to generate a valid university timetable."""
        req = request or GenerateTimetableRequest()
        ds = dataset or get_dataset()

        solver = TimetableSolver(ds)
        result = solver.solve(
            time_limit_seconds=req.time_limit_seconds,
            num_workers=req.num_workers,
            optimize_soft=req.optimize_soft,
            team_name=req.team_name,
        )

        cls._latest_result = result

        if not result.is_success or result.schedule is None:
            metadata = result.to_metadata(total_sessions=len(ds.sessions))
            empty_schedule = TimetableSchedule(
                team=req.team_name, dataset_id=ds.dataset_id, sessions=[]
            )
            response = TimetableResponse(
                schedule=empty_schedule,
                metadata=metadata,
                violations=result.hard_violations,
            )
            cls._latest_response = response
            return response

        # Export draft to exports/timetable_draft.json
        cls._export_draft(result.schedule)

        metadata = result.to_metadata(total_sessions=len(ds.sessions))
        response = TimetableResponse(
            schedule=result.schedule,
            metadata=metadata,
            violations=result.hard_violations,
        )
        cls._latest_response = response
        return response

    @classmethod
    def get_latest(cls) -> TimetableResponse | None:
        """Retrieve the most recently generated timetable in memory or from export file."""
        if cls._latest_response is not None:
            return cls._latest_response

        # Attempt to recover from disk if previously exported
        if TIMETABLE_DRAFT_PATH.exists():
            try:
                raw = json.loads(TIMETABLE_DRAFT_PATH.read_text(encoding="utf-8"))
                schedule = TimetableSchedule.model_validate(raw)
                ds = get_dataset()
                validation = TimetableValidator.validate_schedule(ds, schedule)
                hard_by_rule: dict[str, int] = {}
                for v in validation.hard_violations:
                    r = v.get("rule", "UNKNOWN")
                    hard_by_rule[r] = hard_by_rule.get(r, 0) + 1

                metadata = TimetableSolverMetadata(
                    solver_status="OPTIMAL" if validation.is_valid else "FEASIBLE",
                    solve_time_seconds=0.0,
                    scheduled_sessions=len(schedule.sessions),
                    total_sessions=len(ds.sessions),
                    hard_violation_count=validation.hard_violation_count,
                    soft_penalty=validation.soft_penalty,
                    objective_value=None,
                    hard_by_rule=hard_by_rule,
                    soft_penalties=validation.soft_penalties,
                )
                cls._latest_response = TimetableResponse(
                    schedule=schedule,
                    metadata=metadata,
                    violations=validation.hard_violations,
                )
                return cls._latest_response
            except Exception as exc:
                logger.warning("Could not restore timetable from %s: %s", TIMETABLE_DRAFT_PATH, exc)

        return None

    @classmethod
    def get_validation(cls) -> TimetableValidationResponse | None:
        """Validate the latest timetable and return validation details."""
        latest = cls.get_latest()
        if latest is None:
            return None

        ds = get_dataset()
        return TimetableValidator.validate_schedule(ds, latest.schedule)

    @classmethod
    def clear_state(cls) -> None:
        """Reset internal state (primarily used in testing)."""
        cls._latest_result = None
        cls._latest_response = None

    @classmethod
    def _export_draft(cls, schedule: TimetableSchedule) -> None:
        """Persist timetable draft to exports/timetable_draft.json and merge sessions into schedule_draft.json."""
        try:
            EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
            draft_payload = schedule.model_dump()
            TIMETABLE_DRAFT_PATH.write_text(
                json.dumps(draft_payload, indent=2), encoding="utf-8"
            )
            logger.info("Exported timetable draft to %s", TIMETABLE_DRAFT_PATH)

            combined_schedule: dict[str, Any] = {
                "team": schedule.team,
                "dataset_id": schedule.dataset_id,
                "sessions": draft_payload.get("sessions", []),
                "fest_week": {
                    "bookings": [],
                    "session_overrides": [],
                },
                "exams": [],
            }

            if SCHEDULE_DRAFT_PATH.exists():
                try:
                    combined_schedule = json.loads(
                        SCHEDULE_DRAFT_PATH.read_text(encoding="utf-8")
                    )
                except Exception:
                    pass
            elif EXAMS_DRAFT_PATH.exists():
                try:
                    ex_raw = json.loads(EXAMS_DRAFT_PATH.read_text(encoding="utf-8"))
                    combined_schedule["exams"] = ex_raw.get("exams", [])
                except Exception:
                    pass

            combined_schedule["sessions"] = draft_payload.get("sessions", [])
            combined_schedule["team"] = schedule.team
            combined_schedule["dataset_id"] = schedule.dataset_id

            SCHEDULE_DRAFT_PATH.write_text(
                json.dumps(combined_schedule, indent=2), encoding="utf-8"
            )
            logger.info("Merged sessions into schedule draft at %s", SCHEDULE_DRAFT_PATH)
        except Exception as exc:
            logger.error("Failed to export timetable draft: %s", exc)

