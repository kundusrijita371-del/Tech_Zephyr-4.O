"""Automated tests for TimetableSolver using Google OR-Tools CP-SAT."""

from __future__ import annotations

import pytest

from app.engine.timetable_solver import TimetableSolver
from app.models.dataset import Dataset, Session
from app.services.dataset_service import get_dataset


@pytest.fixture(scope="module")
def dataset() -> Dataset:
    return get_dataset()


class TestTimetableSolver:
    """Verifies solver correctness, CP-SAT constraints, and official validation."""

    def test_solve_hard_constraints_only(self, dataset: Dataset) -> None:
        """Solver must find a clash-free timetable (0 hard violations) in feasibility mode."""
        solver = TimetableSolver(dataset)
        result = solver.solve(
            time_limit_seconds=30.0,
            num_workers=8,
            optimize_soft=False,
            team_name="TestHackerX",
        )

        assert result.status in ("OPTIMAL", "FEASIBLE")
        assert result.is_success is True
        assert len(result.assignment) == len(dataset.sessions) == 189
        assert result.schedule is not None
        assert len(result.schedule.sessions) == 189
        assert result.hard_violation_count == 0, f"Violations: {result.hard_violations}"

    def test_solve_with_soft_optimization(self, dataset: Dataset) -> None:
        """Solver must optimize soft penalties while maintaining 0 hard violations."""
        solver = TimetableSolver(dataset)
        result = solver.solve(
            time_limit_seconds=30.0,
            num_workers=8,
            optimize_soft=True,
            team_name="TestHackerX",
        )

        assert result.status in ("OPTIMAL", "FEASIBLE")
        assert result.is_success is True
        assert len(result.assignment) == 189
        assert result.hard_violation_count == 0, f"Violations: {result.hard_violations}"
        assert result.soft_penalty > 0
        assert "S1" in result.soft_penalties
        assert "S5" in result.soft_penalties
        assert "S6" in result.soft_penalties

    def test_elective_basket_synchronization(self, dataset: Dataset) -> None:
        """Sessions sharing a basket_slot must be at identical (day, start_period) in distinct rooms."""
        solver = TimetableSolver(dataset)
        result = solver.solve(
            time_limit_seconds=30.0,
            num_workers=8,
            optimize_soft=True,
            team_name="TestHackerX",
        )
        assert result.is_success is True

        assign = result.assignment

        # Group sessions by basket_slot
        baskets: dict[str, list[tuple[str, int, str]]] = {}
        for s in dataset.sessions:
            if s.basket_slot:
                baskets.setdefault(s.basket_slot, []).append(assign[s.id])

        assert len(baskets) == 3  # OEB-1, OEB-2, OEB-3
        for basket_id, placements in baskets.items():
            assert len(placements) == 3  # 3 elective courses in each basket
            # All 3 must share identical day and start_period
            times = {(day, start) for day, start, _ in placements}
            assert len(times) == 1, (
                f"Basket {basket_id} sessions do not share identical time slot: {times}"
            )
            # All 3 must use distinct rooms
            rooms = {room_id for _, _, room_id in placements}
            assert len(rooms) == 3, (
                f"Basket {basket_id} sessions double-book rooms: {rooms}"
            )

    def test_infeasible_problem_handling(self, dataset: Dataset) -> None:
        """Solver must detect infeasibility when a session has conflicting hard requirements."""
        # Create an impossible dataset with an unsatisfiable session
        impossible_session = Session(
            id="UNSAT-SESSION-999",
            course_id="CS999",
            kind="lecture",
            groups=["Y1-A"],
            faculty_id="F01",
            size=50000,  # Impossible size
            duration=1,
            room_types=["classroom"],
            needs_accessible=False,
            basket_slot=None,
            fixed_slot=None,
        )

        mutated_data = dataset.model_dump()
        mutated_data["sessions"].append(impossible_session.model_dump())
        impossible_dataset = Dataset.model_validate(mutated_data)

        solver = TimetableSolver(impossible_dataset)
        result = solver.solve(time_limit_seconds=5.0, num_workers=2)

        assert result.is_success is False
        assert result.status in ("INFEASIBLE", "UNKNOWN")
        assert len(result.assignment) == 0

