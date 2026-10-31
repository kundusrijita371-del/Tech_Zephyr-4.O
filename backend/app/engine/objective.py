"""Soft constraint objective formulation for CIT timetable generation.

Implements the official penalty definitions from validator.py:
  - S1: Faculty avoid preferences (2 pts per teaching hour in avoid windows).
  - S3: More than 6 teaching hours for a student group in a day (3 pts per extra hour).
  - S4: Repeated lectures of the same course for a group/basket on the same day (3 pts per duplicate).
  - S5: Low room utilisation below 40% capacity (1 pt per affected session).
  - S6: Use of period 9 (1 pt per affected session).
  - S2: Evaluated and reported according to the exact official validator logic.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from ortools.sat.python import cp_model

from app.engine.candidate_generator import CandidatePlacement
from app.engine.constraints import TimetableConstraintBuilder
from app.models.dataset import Dataset, Session


class SoftObjectiveBuilder:
    """Builds CP-SAT linear objective minimizing official soft penalties."""

    def __init__(
        self,
        model: cp_model.CpModel,
        dataset: Dataset,
        builder: TimetableConstraintBuilder,
    ) -> None:
        self.model = model
        self.dataset = dataset
        self.builder = builder
        self.objective_terms: list[cp_model.LinearExpr] = []

    def build_soft_objective(self) -> cp_model.LinearExpr:
        """Construct the combined soft penalty minimization objective."""
        self._add_candidate_level_penalties()  # S1, S5, S6
        self._add_s3_student_group_daily_hours()  # S3
        self._add_s4_repeated_course_lectures()  # S4

        if self.objective_terms:
            total_objective = sum(self.objective_terms)
            self.model.Minimize(total_objective)
            return total_objective

        return 0

    def _add_candidate_level_penalties(self) -> None:
        """S1, S5, and S6 can be evaluated directly per candidate placement."""
        for (sid, idx), var in self.builder.x_vars.items():
            cand = self.builder.candidates[sid][idx]
            cand_penalty = cand.cost_s1 + cand.cost_s5 + cand.cost_s6
            if cand_penalty > 0:
                self.objective_terms.append(cand_penalty * var)

    def _add_s3_student_group_daily_hours(self) -> None:
        """S3: Penalty of 3 points for each teaching hour over 6 in a single day for a group."""
        calendar = self.dataset.calendar

        # Accumulate hours per (group, day)
        group_daily_hours: dict[tuple[str, str], list[tuple[int, cp_model.IntVar]]] = defaultdict(list)

        for sid, cands in self.builder.candidates.items():
            session = self.builder.sessions_by_id[sid]
            # Baskets handled separately to avoid triple-counting Year 3 groups
            if not session.basket_slot:
                dur = session.duration
                for idx, cand in enumerate(cands):
                    var = self.builder.x_vars[(sid, idx)]
                    for g in session.groups:
                        group_daily_hours[(g, cand.day)].append((dur, var))

        # Add basket contribution once per basket
        for basket_id, b_sessions in self.builder.baskets.items():
            b_groups = b_sessions[0].groups
            dur = b_sessions[0].duration
            for (b, day, start), b_var in self.builder.basket_time_vars.items():
                if b == basket_id:
                    for g in b_groups:
                        group_daily_hours[(g, day)].append((dur, b_var))

        for (g, day), terms in group_daily_hours.items():
            if not terms:
                continue
            excess_var = self.model.NewIntVar(0, 9, f"s3_excess_{g}_{day}")
            # excess >= sum(hours) - 6
            total_hours = sum(dur * var for dur, var in terms)
            self.model.Add(excess_var >= total_hours - 6)
            self.objective_terms.append(3 * excess_var)

    def _add_s4_repeated_course_lectures(self) -> None:
        """S4: Penalty of 3 points per duplicate lecture of the same course on the same day."""
        calendar = self.dataset.calendar

        # (group, day, course_id) -> list of lecture vars
        group_course_lectures: dict[tuple[str, str, str], list[cp_model.IntVar]] = defaultdict(list)

        for sid, cands in self.builder.candidates.items():
            session = self.builder.sessions_by_id[sid]
            if session.kind == "lecture" and not session.basket_slot:
                course_id = session.course_id
                for idx, cand in enumerate(cands):
                    var = self.builder.x_vars[(sid, idx)]
                    for g in session.groups:
                        group_course_lectures[(g, cand.day, course_id)].append(var)

        for (g, day, course_id), vars_list in group_course_lectures.items():
            if len(vars_list) > 1:
                excess_var = self.model.NewIntVar(
                    0, len(vars_list), f"s4_excess_{g}_{day}_{course_id}"
                )
                self.model.Add(excess_var >= sum(vars_list) - 1)
                self.objective_terms.append(3 * excess_var)

        # Basket lectures of the same course twice in a day
        # In cit_public.json, OE301 has 3 lectures across OEB-1, OEB-2, OEB-3
        basket_course_days: dict[tuple[str, str], list[cp_model.IntVar]] = defaultdict(list)
        for basket_id, b_sessions in self.builder.baskets.items():
            for s in b_sessions:
                cid = s.course_id
                for (b, day, start), b_var in self.builder.basket_time_vars.items():
                    if b == basket_id:
                        basket_course_days[(cid, day)].append(b_var)

        for (cid, day), vars_list in basket_course_days.items():
            if len(vars_list) > 1:
                excess_var = self.model.NewIntVar(
                    0, len(vars_list), f"s4_basket_{cid}_{day}"
                )
                self.model.Add(excess_var >= sum(vars_list) - 1)
                self.objective_terms.append(3 * excess_var)

