"""Tests for CP-SAT Midsem Examination Scheduler.

Verifies:
- All 41 exams scheduled.
- 50% room capacity rule strictly respected.
- Multi-room allocations for exams with size > 250 (e.g. EX-MA101, EX-PH101, etc.).
- Only exam-capable rooms used ("exam" in allowed_uses).
- Zero room clashes in any (day, session) slot.
- Zero group clashes in any (day, session) slot.
- Zero hard violations against official starter pack validator check_exams().
"""

from __future__ import annotations

import pytest

from app.engine.exam_solver import ExamSolver
from app.models.dataset import Dataset
from app.services.dataset_service import get_dataset
from app.services.validation_service import ExamValidator


@pytest.fixture(scope="module")
def dataset() -> Dataset:
    return get_dataset()


class TestExamModelAndPreconditions:
    def test_exam_count_in_dataset(self, dataset: Dataset) -> None:
        assert len(dataset.exams) == 41

    def test_exam_rooms_identification(self, dataset: Dataset) -> None:
        exam_rooms = [r for r in dataset.rooms if "exam" in r.allowed_uses]
        assert len(exam_rooms) == 19
        forbidden_rooms = [r for r in dataset.rooms if "exam" not in r.allowed_uses]
        assert len(forbidden_rooms) == 8

    def test_room_half_capacity_calculation(self, dataset: Dataset) -> None:
        aud = next(r for r in dataset.rooms if r.id == "AUD")
        assert aud.capacity == 500
        assert aud.capacity // 2 == 250

        lh1 = next(r for r in dataset.rooms if r.id == "LH-1")
        assert lh1.capacity == 200
        assert lh1.capacity // 2 == 100

        cr205 = next(r for r in dataset.rooms if r.id == "CR-205")
        assert cr205.capacity == 60
        assert cr205.capacity // 2 == 30

    def test_large_exam_requires_multiple_rooms(self, dataset: Dataset) -> None:
        large_exam = next(e for e in dataset.exams if e.id == "EX-MA101")
        assert large_exam.size == 360
        # Largest room AUD has half capacity 250, which is < 360, so multi-room allocation is mandatory
        max_single_half_cap = max(
            r.capacity // 2 for r in dataset.rooms if "exam" in r.allowed_uses
        )
        assert large_exam.size > max_single_half_cap


class TestExamSolverExecution:
    @pytest.fixture(scope="class")
    @classmethod
    def solved_result(cls, dataset: Dataset):
        solver = ExamSolver(
            dataset=dataset,
            team_name="TestHackerX",
            time_limit_seconds=30.0,
            num_workers=8,
            optimize_soft=True,
        )
        schedule, metadata, violations = solver.solve()
        return schedule, metadata, violations

    def test_solver_status_optimal_or_feasible(self, solved_result) -> None:
        schedule, metadata, violations = solved_result
        assert metadata.solver_status in ("OPTIMAL", "FEASIBLE")

    def test_all_41_exams_scheduled(self, solved_result) -> None:
        schedule, metadata, violations = solved_result
        assert metadata.total_exams == 41
        assert metadata.scheduled_exams == 41
        assert len(schedule.exams) == 41

    def test_zero_official_validator_violations(self, dataset: Dataset, solved_result) -> None:
        schedule, metadata, violations = solved_result
        assert metadata.hard_violation_count == 0
        assert len(violations) == 0

        # Run independent official validation
        val = ExamValidator.validate_schedule(dataset, schedule)
        assert val.is_valid is True
        assert val.hard_violation_count == 0
        assert len(val.hard_violations) == 0

    def test_every_exam_has_sufficient_effective_capacity(
        self, dataset: Dataset, solved_result
    ) -> None:
        schedule, metadata, violations = solved_result
        exam_dict = {e.id: e for e in dataset.exams}
        room_half_cap = {
            r.id: r.capacity // 2 for r in dataset.rooms if "exam" in r.allowed_uses
        }

        for item in schedule.exams:
            target_size = exam_dict[item.exam_id].size
            eff_cap = sum(room_half_cap[rid] for rid in item.rooms)
            assert eff_cap >= target_size, (
                f"{item.exam_id} needs {target_size} seats, but got {eff_cap}"
            )
            assert item.effective_capacity == eff_cap

    def test_multi_room_allocation_for_360_seat_exams(self, solved_result) -> None:
        schedule, metadata, violations = solved_result
        large_ids = ["EX-MA101", "EX-PH101", "EX-CS101", "EX-HS101", "EX-HS201", "EX-OE-BASKET"]
        for item in schedule.exams:
            if item.exam_id in large_ids:
                assert len(item.rooms) >= 2, (
                    f"Large exam {item.exam_id} (size {item.size}) must use multiple rooms"
                )

    def test_no_room_double_booking_in_same_slot(self, solved_result) -> None:
        schedule, metadata, violations = solved_result
        room_slot_seen: set[tuple[str, str, str]] = set()

        for item in schedule.exams:
            for rid in item.rooms:
                key = (rid, item.day, item.session)
                assert key not in room_slot_seen, f"Room {rid} double-booked in {item.day} {item.session}"
                room_slot_seen.add(key)

    def test_no_group_double_booking_in_same_slot(
        self, dataset: Dataset, solved_result
    ) -> None:
        schedule, metadata, violations = solved_result
        exam_dict = {e.id: e for e in dataset.exams}
        group_slot_seen: set[tuple[str, str, str]] = set()

        for item in schedule.exams:
            for g in exam_dict[item.exam_id].groups:
                key = (g, item.day, item.session)
                assert key not in group_slot_seen, f"Group {g} double-booked in {item.day} {item.session}"
                group_slot_seen.add(key)

    def test_soft_penalty_is_zero_or_minimal(self, solved_result) -> None:
        schedule, metadata, violations = solved_result
        # The solver easily achieves 0 soft penalty (<= 1 exam per student group per day)
        assert metadata.soft_penalty == 0
