"""Google OR-Tools CP-SAT Midsem Examination Scheduler for CIT.

Satisfies all official validator rules:
- E1: Every exam scheduled exactly once within valid calendar exam days and sessions.
- E2: Every assigned room allows examinations ("exam" in allowed_uses).
- H5: Effective capacity (50% normal capacity) >= student size (multi-room assignment allowed).
- H4: No room is double-booked in the same (day, session).
- H3: No student group has multiple examinations in the same (day, session).
- Soft: Minimize group multi-exam penalty (penalty of 5 per additional exam per group on the same day).
"""

from __future__ import annotations

import logging
import time
from typing import Any

from ortools.sat.python import cp_model

from app.models.dataset import Dataset, Exam, Room
from app.models.exam import (
    ExamAssignmentItem,
    ExamSchedule,
    ExamSolverMetadata,
)
from app.services.validation_service import ExamValidator

logger = logging.getLogger(__name__)


class ExamSolver:
    """Exact CP-SAT solver for scheduling midsem examinations."""

    def __init__(
        self,
        dataset: Dataset,
        team_name: str = "HackerX",
        time_limit_seconds: float = 30.0,
        num_workers: int = 8,
        optimize_soft: bool = True,
    ) -> None:
        self.dataset = dataset
        self.team_name = team_name
        self.time_limit_seconds = time_limit_seconds
        self.num_workers = num_workers
        self.optimize_soft = optimize_soft

        # Cache exam-capable rooms and precalculate half capacities
        self.exam_rooms: list[Room] = [
            r for r in self.dataset.rooms if "exam" in r.allowed_uses
        ]
        self.room_half_cap: dict[str, int] = {
            r.id: r.capacity // 2 for r in self.exam_rooms
        }

        # Calendar configuration
        exam_week = self.dataset.calendar.exam_week
        self.days: list[str] = exam_week.days
        self.sessions: list[str] = [s.id for s in exam_week.sessions]

        # 12 examination slots: (day, session)
        self.slots: list[tuple[str, str]] = [
            (d, s) for d in self.days for s in self.sessions
        ]

    def solve(self) -> tuple[ExamSchedule, ExamSolverMetadata, list[dict[str, Any]]]:
        """Formulate and solve the exam scheduling problem with CP-SAT."""
        start_time = time.perf_counter()
        model = cp_model.CpModel()
        exams: list[Exam] = self.dataset.exams

        # 1. S[e_id, slot_idx]: exam assigned to slot
        S: dict[tuple[str, int], cp_model.IntVar] = {}
        for e in exams:
            for t_idx in range(len(self.slots)):
                S[e.id, t_idx] = model.new_bool_var(f"S_{e.id}_{t_idx}")
            # Exactly one slot per exam (Rule E1)
            model.add_exactly_one([S[e.id, t_idx] for t_idx in range(len(self.slots))])

        # 2. R[e_id, room_id]: exam assigned to room
        R: dict[tuple[str, str], cp_model.IntVar] = {}
        for e in exams:
            for r in self.exam_rooms:
                R[e.id, r.id] = model.new_bool_var(f"R_{e.id}_{r.id}")
            # Capacity constraint: sum(half_cap * R) >= e.size (Rule H5)
            model.add(
                sum(self.room_half_cap[r.id] * R[e.id, r.id] for r in self.exam_rooms)
                >= e.size
            )

        # 3. Y[e_id, room_id, slot_idx]: exam e uses room r in slot t
        # Linearized coupling: Y[e, r, t] <= S[e, t], sum_t Y[e, r, t] == R[e, r]
        Y: dict[tuple[str, str, int], cp_model.IntVar] = {}
        for e in exams:
            for r in self.exam_rooms:
                for t_idx in range(len(self.slots)):
                    Y[e.id, r.id, t_idx] = model.new_bool_var(
                        f"Y_{e.id}_{r.id}_{t_idx}"
                    )
                    model.add(Y[e.id, r.id, t_idx] <= S[e.id, t_idx])
                model.add(
                    sum(Y[e.id, r.id, t_idx] for t_idx in range(len(self.slots)))
                    == R[e.id, r.id]
                )

        # 4. Room conflict: at most one exam in room r at slot t (Rule H4)
        for r in self.exam_rooms:
            for t_idx in range(len(self.slots)):
                model.add(sum(Y[e.id, r.id, t_idx] for e in exams) <= 1)

        # 5. Group conflict: at most one exam for student group g at slot t (Rule H3)
        all_groups = {g.id for g in self.dataset.student_groups}
        for g in all_groups:
            g_exams = [e for e in exams if g in e.groups]
            if not g_exams:
                continue
            for t_idx in range(len(self.slots)):
                model.add(sum(S[e.id, t_idx] for e in g_exams) <= 1)

        # 6. Objective: minimize soft penalty (Rule soft_score: multiple exams on same day)
        # and room usage / wasted capacity
        excess_vars: list[cp_model.IntVar] = []
        for g in all_groups:
            g_exams = [e for e in exams if g in e.groups]
            if len(g_exams) <= 1:
                continue
            for d_idx in range(len(self.days)):
                t_am = 2 * d_idx
                t_pm = 2 * d_idx + 1
                exams_today = sum(S[e.id, t_am] + S[e.id, t_pm] for e in g_exams)
                excess = model.new_int_var(0, len(g_exams), f"excess_{g}_{d_idx}")
                model.add(excess >= exams_today - 1)
                excess_vars.append(excess)

        # Room efficiency: minimize room count and excess capacity slack
        slack_expr = []
        for e in exams:
            total_assigned_cap = sum(
                self.room_half_cap[r.id] * R[e.id, r.id] for r in self.exam_rooms
            )
            slack_expr.append(total_assigned_cap - e.size)

        if self.optimize_soft:
            # 1000 weight on group excess guarantees zero same-day multi-exam clashes if feasible
            # 10 weight on room count prioritizes compact room allocations
            # 1 weight on seat slack prevents allocating massively oversized rooms
            model.minimize(
                1000 * sum(excess_vars)
                + 10 * sum(R[e.id, r.id] for e in exams for r in self.exam_rooms)
                + sum(slack_expr)
            )
        else:
            model.minimize(
                10 * sum(R[e.id, r.id] for e in exams for r in self.exam_rooms)
                + sum(slack_expr)
            )

        # 7. Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.time_limit_seconds
        solver.parameters.num_workers = self.num_workers

        status_int = solver.solve(model)
        solve_duration = time.perf_counter() - start_time
        status_name = solver.status_name(status_int)

        status_mapping = {
            "OPTIMAL": "OPTIMAL",
            "FEASIBLE": "FEASIBLE",
            "INFEASIBLE": "INFEASIBLE",
            "MODEL_INVALID": "UNKNOWN",
            "UNKNOWN": "UNKNOWN",
        }
        solver_status = status_mapping.get(status_name, "UNKNOWN")

        # 8. Extract assignments
        scheduled_items: list[ExamAssignmentItem] = []
        rooms_used_set: set[str] = set()
        total_capacity_provided = 0
        total_students_seated = 0

        if solver_status in ("OPTIMAL", "FEASIBLE"):
            for e in exams:
                assigned_day = ""
                assigned_session = ""
                for t_idx, (d, s) in enumerate(self.slots):
                    if solver.value(S[e.id, t_idx]) == 1:
                        assigned_day = d
                        assigned_session = s
                        break

                assigned_rooms: list[str] = []
                for r in self.exam_rooms:
                    if solver.value(R[e.id, r.id]) == 1:
                        assigned_rooms.append(r.id)
                        rooms_used_set.add(r.id)

                eff_cap = sum(self.room_half_cap[rid] for rid in assigned_rooms)
                total_capacity_provided += eff_cap
                total_students_seated += e.size

                scheduled_items.append(
                    ExamAssignmentItem(
                        exam_id=e.id,
                        day=assigned_day,
                        session=assigned_session,
                        rooms=assigned_rooms,
                        course_ids=e.course_ids,
                        groups=e.groups,
                        size=e.size,
                        effective_capacity=eff_cap,
                    )
                )

        schedule = ExamSchedule(
            team=self.team_name,
            dataset_id=self.dataset.dataset_id,
            exams=scheduled_items,
        )

        # 9. Official validator verification
        val_response = ExamValidator.validate_schedule(self.dataset, schedule)
        hard_violations = val_response.hard_violations
        soft_penalty = val_response.soft_penalty

        hard_by_rule: dict[str, int] = {}
        for v in hard_violations:
            rule = v.get("rule", "UNKNOWN")
            hard_by_rule[rule] = hard_by_rule.get(rule, 0) + 1

        metadata = ExamSolverMetadata(
            solver_status=solver_status,  # type: ignore[arg-type]
            solve_time_seconds=round(solve_duration, 4),
            total_exams=len(exams),
            scheduled_exams=len(scheduled_items),
            hard_violation_count=len(hard_violations),
            soft_penalty=soft_penalty,
            objective_value=(
                solver.objective_value
                if solver_status in ("OPTIMAL", "FEASIBLE")
                else None
            ),
            hard_by_rule=hard_by_rule,
            rooms_used_count=len(rooms_used_set),
            total_capacity_provided=total_capacity_provided,
            total_students_seated=total_students_seated,
        )

        return schedule, metadata, hard_violations

