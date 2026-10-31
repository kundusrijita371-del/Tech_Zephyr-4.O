"""Optimization and evaluation utilities for schedule repair.

Computes stability scores, deviation penalties, and orchestrates the official
starter pack validator with baseline comparison for full validation.
"""

from __future__ import annotations

import copy
from typing import Any

from app.models.dataset import Dataset
from app.models.disruption import DisruptionRequest
from app.models.rescheduling import ReschedulingValidationReport
from app.services.validation_service import validator


class RepairOptimizer:
    """Evaluates stability and executes full official validation on repaired schedules."""

    @staticmethod
    def apply_disruption_to_raw_dataset(
        raw_dataset: dict[str, Any], disruption: DisruptionRequest
    ) -> dict[str, Any]:
        """Apply disruption changes to raw dataset dictionary per official validator format."""
        changes = disruption.to_official_changes()
        disruption_dict = {
            "id": disruption.disruption_id,
            "dataset": raw_dataset.get("dataset_id", "cit-public-v1"),
            "changes": changes,
        }
        return validator.apply_disruption(raw_dataset, disruption_dict)

    @classmethod
    def validate_repaired_schedule(
        cls,
        dataset: Dataset,
        disruption: DisruptionRequest,
        repaired_schedule: dict[str, Any],
        baseline_schedule: dict[str, Any],
    ) -> ReschedulingValidationReport:
        """Run official validator on repaired schedule with baseline stability comparison."""
        raw_ds = dataset.model_dump()
        disrupted_raw_ds = cls.apply_disruption_to_raw_dataset(raw_ds, disruption)

        # Official validator run
        report = validator.run(disrupted_raw_ds, repaired_schedule, baseline=baseline_schedule)

        v_count = report.get("hard_violation_count", 0)
        violations = report.get("hard_violations", [])
        soft_penalties = report.get("soft_penalties", {})
        soft_total = report.get("soft_total", 0)

        exam_pen = report.get("exam_soft_penalty", 0)
        b_stats = report.get("bookings", {})
        b_score = b_stats.get("booking_score", 0.0)
        b_inversions = len(b_stats.get("priority_inversions", []))

        stability = report.get("stability", {})
        sessions_moved = stability.get("sessions_moved", 0)
        time_changed = stability.get("time_changed", 0)
        room_only_changed = stability.get("room_only_changed", 0)

        return ReschedulingValidationReport(
            is_valid=(v_count == 0),
            hard_violation_count=v_count,
            hard_violations=violations,
            soft_penalty=soft_total,
            soft_penalties=soft_penalties,
            exam_soft_penalty=exam_pen,
            booking_score=b_score,
            booking_inversions=b_inversions,
            sessions_moved=sessions_moved,
            time_changed=time_changed,
            room_only_changed=room_only_changed,
        )

