"""Timetable solver using Google OR-Tools CP-SAT.

Solves the university timetabling problem deterministically, enforcing all
hard constraints and optimizing soft penalties per the official CIT benchmark.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

from ortools.sat.python import cp_model

from app.engine.candidate_generator import CandidateGenerator, CandidatePlacement
from app.engine.constraints import TimetableConstraintBuilder
from app.engine.objective import SoftObjectiveBuilder
from app.models.dataset import Dataset
from app.models.timetable import (
    TimetableSchedule,
    TimetableSessionAssignment,
    TimetableSolverMetadata,
)
from app.services.validation_service import TimetableValidator

logger = logging.getLogger(__name__)


@dataclass
class SolverResult:
    """Detailed result container returned by TimetableSolver."""
    status: str  # "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN"
    is_success: bool
    solve_time_seconds: float
    assignment: dict[str, tuple[str, int, str]] = field(default_factory=dict)
    schedule: TimetableSchedule | None = None
    objective_value: float | None = None
    hard_violations: list[dict[str, Any]] = field(default_factory=list)
    hard_violation_count: int = 0
    soft_penalty: int = 0
    hard_by_rule: dict[str, int] = field(default_factory=dict)
    soft_penalties: dict[str, int] = field(default_factory=dict)
    diagnostics: list[str] = field(default_factory=list)

    def to_metadata(self, total_sessions: int) -> TimetableSolverMetadata:
        """Convert result into serializable metadata."""
        return TimetableSolverMetadata(
            solver_status=self.status,  # type: ignore[arg-type]
            solve_time_seconds=round(self.solve_time_seconds, 3),
            scheduled_sessions=len(self.assignment),
            total_sessions=total_sessions,
            hard_violation_count=self.hard_violation_count,
            soft_penalty=self.soft_penalty,
            objective_value=round(self.objective_value, 2) if self.objective_value is not None else None,
            hard_by_rule=self.hard_by_rule,
            soft_penalties=self.soft_penalties,
        )


class TimetableSolver:
    """Deterministic university timetable solver using Google OR-Tools CP-SAT."""

    def __init__(self, dataset: Dataset) -> None:
        self.dataset = dataset

    def solve(
        self,
        time_limit_seconds: float = 30.0,
        num_workers: int = 8,
        optimize_soft: bool = True,
        team_name: str = "HackerX",
    ) -> SolverResult:
        """Generate a complete timetable for all dataset sessions.

        Args:
            time_limit_seconds: Max CP-SAT search duration in seconds.
            num_workers: Thread count for multi-worker search.
            optimize_soft: If True, minimizes soft penalties; if False, solves hard feasibility.
            team_name: Team identifier for exported schedule format.

        Returns:
            SolverResult: Result with status, schedule, and validation report.
        """
        total_sessions = len(self.dataset.sessions)
        logger.info(
            "Starting timetable solve for %d sessions (time_limit=%.1fs, workers=%d, soft=%s)",
            total_sessions,
            time_limit_seconds,
            num_workers,
            optimize_soft,
        )

        # 1. Candidate generation
        generator = CandidateGenerator(self.dataset)
        candidates, diags = generator.generate_all()

        # Check for unplannable sessions
        empty_sessions = [sid for sid, cands in candidates.items() if not cands]
        if empty_sessions:
            logger.error("Empty candidate sets for sessions: %s", empty_sessions)
            reasons = [
                f"{sid}: {'; '.join(diags[sid].reasons)}"
                for sid in empty_sessions
                if sid in diags
            ]
            return SolverResult(
                status="INFEASIBLE",
                is_success=False,
                solve_time_seconds=0.0,
                diagnostics=reasons,
            )

        # 2. Build CP-SAT Model & Constraints
        model = cp_model.CpModel()
        constraint_builder = TimetableConstraintBuilder(
            model=model, dataset=self.dataset, candidates=candidates
        )
        constraint_builder.build_variables_and_constraints()

        # 3. Soft constraint objective
        if optimize_soft:
            obj_builder = SoftObjectiveBuilder(
                model=model, dataset=self.dataset, builder=constraint_builder
            )
            obj_builder.build_soft_objective()

        # 4. Solver configuration
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_seconds)
        solver.parameters.num_workers = int(num_workers)
        solver.parameters.log_search_progress = False

        # 5. Solve
        start_time = time.perf_counter()
        raw_status = solver.Solve(model)
        solve_duration = time.perf_counter() - start_time

        status_map = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE",
            cp_model.INFEASIBLE: "INFEASIBLE",
            cp_model.MODEL_INVALID: "UNKNOWN",
            cp_model.UNKNOWN: "UNKNOWN",
        }
        status_name = status_map.get(raw_status, "UNKNOWN")
        logger.info("CP-SAT solver returned %s in %.2fs", status_name, solve_duration)

        if raw_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return SolverResult(
                status=status_name,
                is_success=False,
                solve_time_seconds=solve_duration,
                diagnostics=[f"CP-SAT returned {status_name} without finding a solution."],
            )

        # 6. Extract assignment
        assignment: dict[str, tuple[str, int, str]] = {}
        schedule_sessions: list[TimetableSessionAssignment] = []
        sess_by_id = {s.id: s for s in self.dataset.sessions}
        course_by_id = {c.id: c.title for c in self.dataset.courses}
        fac_by_id = {f.id: f.name for f in self.dataset.faculty}

        for sid, cands in candidates.items():
            chosen_cand: CandidatePlacement | None = None
            for idx, cand in enumerate(cands):
                var = constraint_builder.x_vars[(sid, idx)]
                if solver.Value(var) == 1:
                    chosen_cand = cand
                    break

            if chosen_cand is not None:
                assignment[sid] = (
                    chosen_cand.day,
                    chosen_cand.start_period,
                    chosen_cand.room_id,
                )
                raw_s = sess_by_id.get(sid)
                c_id = raw_s.course_id if raw_s else None
                c_title = course_by_id.get(c_id) if c_id else None
                f_id = raw_s.faculty_id if raw_s else None
                f_name = fac_by_id.get(f_id) if f_id else None
                grps = raw_s.groups if raw_s else []
                knd = raw_s.kind if raw_s else None
                dur = raw_s.duration if raw_s else 1

                schedule_sessions.append(
                    TimetableSessionAssignment(
                        session_id=sid,
                        day=chosen_cand.day,
                        start_period=chosen_cand.start_period,
                        room_id=chosen_cand.room_id,
                        course_id=c_id,
                        course_title=c_title,
                        faculty_id=f_id,
                        faculty_name=f_name,
                        groups=grps,
                        kind=knd,
                        duration=dur,
                    )
                )

        # Never return a partial timetable as valid
        if len(assignment) != total_sessions:
            logger.error(
                "Partial assignment detected: %d / %d sessions assigned",
                len(assignment),
                total_sessions,
            )
            return SolverResult(
                status="UNKNOWN",
                is_success=False,
                solve_time_seconds=solve_duration,
                diagnostics=[
                    f"Solver failed to schedule all sessions: {len(assignment)}/{total_sessions} assigned"
                ],
            )

        schedule = TimetableSchedule(
            team=team_name,
            dataset_id=self.dataset.dataset_id,
            sessions=schedule_sessions,
        )

        # 7. Validate through untouched official validator.py
        hard_violations, soft_penalties, soft_total = (
            TimetableValidator.validate_assignment(
                self.dataset, assignment, label="timetable"
            )
        )

        hard_by_rule: dict[str, int] = {}
        for v in hard_violations:
            rule = v.get("rule", "UNKNOWN")
            hard_by_rule[rule] = hard_by_rule.get(rule, 0) + 1

        obj_val = solver.ObjectiveValue() if optimize_soft else None

        return SolverResult(
            status=status_name,
            is_success=len(hard_violations) == 0,
            solve_time_seconds=solve_duration,
            assignment=assignment,
            schedule=schedule,
            objective_value=obj_val,
            hard_violations=hard_violations,
            hard_violation_count=len(hard_violations),
            soft_penalty=soft_total,
            hard_by_rule=hard_by_rule,
            soft_penalties=soft_penalties,
        )

