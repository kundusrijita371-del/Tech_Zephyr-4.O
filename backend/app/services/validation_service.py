"""Validation service bridging the untouched official validator.py.

Calls check_timetable() and soft_score() from starter-pack/CrunchWeek_StarterPack/validator.py
without modifying the starter pack files.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any

from app.config import VALIDATOR_DIR
from app.models.booking import BookingValidationReport, FestWeekSchedule
from app.models.dataset import Dataset
from app.models.exam import ExamSchedule, ExamValidationResponse
from app.models.timetable import TimetableSchedule, TimetableValidationResponse

# Ensure validator directory is on sys.path for importing validator
_STARTER_PACK_DIR = VALIDATOR_DIR
if str(_STARTER_PACK_DIR) not in sys.path:
    sys.path.insert(0, str(_STARTER_PACK_DIR))

try:
    import validator  # Official validator module
except ImportError:
    validator_file = _STARTER_PACK_DIR / "validator.py"
    if validator_file.exists():
        spec = importlib.util.spec_from_file_location("validator", str(validator_file))
        if spec and spec.loader:
            validator = importlib.util.module_from_spec(spec)
            sys.modules["validator"] = validator
            spec.loader.exec_module(validator)
        else:
            raise ImportError(f"Failed to create module spec for validator at {validator_file}")
    else:
        raise ImportError(
            f"Failed to import official validator from {_STARTER_PACK_DIR}: validator.py not found"
        )


class TimetableValidator:
    """Wrapper around official validator.py timetable evaluation functions."""

    @staticmethod
    def validate_assignment(
        dataset: Dataset,
        assignment: dict[str, tuple[str, int, str]],
        label: str = "timetable",
    ) -> tuple[list[dict[str, Any]], dict[str, int], int]:
        """Validate timetable assignment using official check_timetable() and soft_score().

        Args:
            dataset: Validated Dataset object.
            assignment: Mapping of session_id -> (day, start_period, room_id).
            label: Label for where violations occurred.

        Returns:
            tuple: (hard_violations, soft_penalties_dict, soft_total)
        """
        raw_data = dataset.model_dump()
        ctx = validator.Ctx(raw_data)

        # Official hard constraint checks
        hard_violations, _ = validator.check_timetable(ctx, assignment, label)

        # Official soft penalty checks
        soft_penalties, soft_total = validator.soft_score(ctx, assignment)

        return hard_violations, soft_penalties, soft_total

    @classmethod
    def validate_schedule(
        cls, dataset: Dataset, schedule: TimetableSchedule
    ) -> TimetableValidationResponse:
        """Validate a TimetableSchedule instance."""
        assignment: dict[str, tuple[str, int, str]] = {}
        for item in schedule.sessions:
            assignment[item.session_id] = (
                item.day,
                item.start_period,
                item.room_id,
            )

        hard_violations, soft_penalties, soft_total = cls.validate_assignment(
            dataset, assignment
        )

        sessions_checked = len(assignment)
        total_sessions = len(dataset.sessions)
        is_valid = len(hard_violations) == 0 and sessions_checked == total_sessions and total_sessions > 0

        return TimetableValidationResponse(
            is_valid=is_valid,
            hard_violation_count=len(hard_violations),
            hard_violations=hard_violations,
            soft_penalty=soft_total,
            soft_penalties=soft_penalties,
            sessions_checked=sessions_checked,
            total_sessions=total_sessions,
        )


class ExamValidator:
    """Wrapper around official validator.py examination evaluation functions."""

    @staticmethod
    def validate_exam_items(
        dataset: Dataset,
        exams_out: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], int]:
        """Validate exam assignments using official check_exams().

        Args:
            dataset: Validated Dataset object.
            exams_out: List of exam dicts with keys: exam_id, day, session, rooms.

        Returns:
            tuple: (hard_violations, soft_penalty)
        """
        raw_data = dataset.model_dump()
        ctx = validator.Ctx(raw_data)
        return validator.check_exams(ctx, exams_out)

    @classmethod
    def validate_schedule(
        cls, dataset: Dataset, schedule: ExamSchedule
    ) -> ExamValidationResponse:
        """Validate an ExamSchedule instance."""
        exams_out: list[dict[str, Any]] = [
            {
                "exam_id": item.exam_id,
                "day": item.day,
                "session": item.session,
                "rooms": item.rooms,
            }
            for item in schedule.exams
        ]

        hard_violations, soft_penalty = cls.validate_exam_items(dataset, exams_out)

        return ExamValidationResponse(
            is_valid=len(hard_violations) == 0,
            hard_violation_count=len(hard_violations),
            hard_violations=hard_violations,
            soft_penalty=soft_penalty,
        )


class BookingValidator:
    """Wrapper around official validator.py check_bookings function."""

    @staticmethod
    def validate_fest_week(
        dataset: Dataset,
        base_timetable: dict[str, tuple[str, int, str]],
        fest_week: FestWeekSchedule | dict[str, Any],
    ) -> BookingValidationReport:
        """Validate fest_week bookings and session overrides against the base timetable.

        Args:
            dataset: Validated Dataset object.
            base_timetable: Mapping of session_id -> (day, start_period, room_id).
            fest_week: FestWeekSchedule instance or dict matching fest_week schema.

        Returns:
            BookingValidationReport containing hard violations, warnings, score, and inversions.
        """
        raw_data = dataset.model_dump()
        ctx = validator.Ctx(raw_data)

        if isinstance(fest_week, FestWeekSchedule):
            fest_dict = fest_week.model_dump()
        else:
            fest_dict = dict(fest_week)

        hard_violations, warnings, report = validator.check_bookings(
            ctx, base_timetable, fest_dict
        )

        return BookingValidationReport(
            is_valid=len(hard_violations) == 0,
            hard_violation_count=len(hard_violations),
            hard_violations=hard_violations,
            warnings=warnings,
            booking_score=report.get("booking_score", 0.0),
            booking_score_max=report.get("booking_score_max_if_all_approved", 0),
            approved_count=report.get("approved", 0),
            rejected_count=report.get("rejected", 0),
            alternative_count=report.get("alternatives", 0),
            session_overrides_count=report.get("session_overrides", 0),
            priority_inversions=report.get("priority_inversions", []),
        )



