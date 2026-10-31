"""CP-SAT constraint formulation for CIT timetable generation.

Implements all official timetable hard constraints:
  - H1: Every session scheduled exactly once.
  - H2: Faculty double-booking prevention.
  - H3: Student group double-booking prevention (with elective basket deduplication).
  - H4: Room double-booking prevention.
  - H11: Elective basket time synchronization (all sessions in basket share day & period).
  - H12: Faculty daily teaching hours hard limits (max_hours_per_day).
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from ortools.sat.python import cp_model

from app.engine.candidate_generator import CandidatePlacement
from app.models.dataset import Dataset, Session


class TimetableConstraintBuilder:
    """Builds CP-SAT decision variables and constraints from candidate placements."""

    def __init__(
        self,
        model: cp_model.CpModel,
        dataset: Dataset,
        candidates: dict[str, list[CandidatePlacement]],
    ) -> None:
        self.model = model
        self.dataset = dataset
        self.candidates = candidates

        self.sessions_by_id: dict[str, Session] = {
            s.id: s for s in dataset.sessions
        }
        self.faculty_max_hours: dict[str, int] = {
            f.id: f.max_hours_per_day for f in dataset.faculty
        }

        # Decision variables: (session_id, cand_idx) -> BoolVar
        self.x_vars: dict[tuple[str, int], cp_model.IntVar] = {}

        # Basket synchronization variables: (basket_slot, day, start) -> BoolVar
        self.basket_time_vars: dict[tuple[str, str, int], cp_model.IntVar] = {}

        # Tracking maps for resource occupancy
        self.room_occupancy: dict[tuple[str, str, int], list[cp_model.IntVar]] = defaultdict(list)
        self.faculty_occupancy: dict[tuple[str, str, int], list[cp_model.IntVar]] = defaultdict(list)
        self.group_occupancy: dict[tuple[str, str, int], list[cp_model.IntVar]] = defaultdict(list)
        self.faculty_daily_hours: dict[tuple[str, str], list[tuple[int, cp_model.IntVar]]] = defaultdict(list)

        # Identify all elective baskets
        self.baskets: dict[str, list[Session]] = defaultdict(list)
        for s in dataset.sessions:
            if s.basket_slot:
                self.baskets[s.basket_slot].append(s)

    def build_variables_and_constraints(self) -> None:
        """Create decision variables and post all hard constraints."""
        self._create_basket_time_variables()
        self._create_session_variables()
        self._add_h1_exact_one_assignment()
        self._add_h11_basket_synchronization()
        self._add_h4_room_exclusivity()
        self._add_h2_faculty_exclusivity()
        self._add_h3_group_exclusivity()
        self._add_h12_faculty_daily_limits()

    def _create_basket_time_variables(self) -> None:
        """Create BoolVars for each possible (day, start) of elective baskets."""
        calendar = self.dataset.calendar
        for basket_id, b_sessions in self.baskets.items():
            dur = b_sessions[0].duration  # all sessions in basket have identical duration
            for day in calendar.days:
                for start in range(1, 10 - dur + 1):
                    pers = list(range(start, start + dur))
                    # Cannot cross lunch
                    if pers[0] <= calendar.lunch.after_period < pers[-1]:
                        continue
                    v = self.model.NewBoolVar(f"basket_{basket_id}_{day}_{start}")
                    self.basket_time_vars[(basket_id, day, start)] = v

            # Basket must run at exactly one (day, start)
            basket_vars = [
                v for (b, _, _), v in self.basket_time_vars.items() if b == basket_id
            ]
            self.model.Add(sum(basket_vars) == 1)

    def _create_session_variables(self) -> None:
        """Create candidate BoolVars and index them into occupancy maps."""
        for sid, cands in self.candidates.items():
            session = self.sessions_by_id[sid]
            dur = session.duration
            fac_id = session.faculty_id
            b_id = session.basket_slot

            for idx, cand in enumerate(cands):
                var = self.model.NewBoolVar(f"x_{sid}_{idx}")
                self.x_vars[(sid, idx)] = var

                # Record room occupancy
                for p in cand.periods:
                    self.room_occupancy[(cand.room_id, cand.day, p)].append(var)

                # Record faculty occupancy
                for p in cand.periods:
                    self.faculty_occupancy[(fac_id, cand.day, p)].append(var)

                # Record faculty daily hours
                self.faculty_daily_hours[(fac_id, cand.day)].append((dur, var))

                # Record student group occupancy for non-basket sessions
                if not b_id:
                    for g in session.groups:
                        for p in cand.periods:
                            self.group_occupancy[(g, cand.day, p)].append(var)

        # Record student group occupancy for baskets
        for basket_id, b_sessions in self.baskets.items():
            b_groups = b_sessions[0].groups
            dur = b_sessions[0].duration
            for (b, day, start), b_var in self.basket_time_vars.items():
                if b == basket_id:
                    for p in range(start, start + dur):
                        for g in b_groups:
                            self.group_occupancy[(g, day, p)].append(b_var)

    def _add_h1_exact_one_assignment(self) -> None:
        """H1: Every session must be scheduled to exactly one candidate placement."""
        for sid, cands in self.candidates.items():
            if not cands:
                raise ValueError(
                    f"Session {sid} has 0 feasible candidate placements. Cannot satisfy H1."
                )
            session_vars = [self.x_vars[(sid, idx)] for idx in range(len(cands))]
            self.model.Add(sum(session_vars) == 1)

    def _add_h11_basket_synchronization(self) -> None:
        """H11: All sessions sharing a basket_slot must run at the identical day and start_period."""
        for basket_id, b_sessions in self.baskets.items():
            for session in b_sessions:
                sid = session.id
                cands = self.candidates[sid]

                # Group candidate vars by (day, start)
                cands_by_time: dict[tuple[str, int], list[cp_model.IntVar]] = defaultdict(list)
                for idx, cand in enumerate(cands):
                    cands_by_time[cand.time_slot_key].append(self.x_vars[(sid, idx)])

                for (b, day, start), b_var in self.basket_time_vars.items():
                    if b == basket_id:
                        time_vars = cands_by_time.get((day, start), [])
                        # If basket runs at (day, start), session must choose a candidate at that time
                        self.model.Add(sum(time_vars) == b_var)

    def _add_h4_room_exclusivity(self) -> None:
        """H4: A room cannot host overlapping sessions in any period."""
        for (room_id, day, p), vars_list in self.room_occupancy.items():
            if len(vars_list) > 1:
                self.model.Add(sum(vars_list) <= 1)

    def _add_h2_faculty_exclusivity(self) -> None:
        """H2: A faculty member cannot teach overlapping sessions."""
        for (fac_id, day, p), vars_list in self.faculty_occupancy.items():
            if len(vars_list) > 1:
                self.model.Add(sum(vars_list) <= 1)

    def _add_h3_group_exclusivity(self) -> None:
        """H3: A student group cannot attend overlapping sessions."""
        for (group_id, day, p), vars_list in self.group_occupancy.items():
            if len(vars_list) > 1:
                self.model.Add(sum(vars_list) <= 1)

    def _add_h12_faculty_daily_limits(self) -> None:
        """H12: Faculty daily teaching hours cannot exceed max_hours_per_day."""
        for (fac_id, day), items in self.faculty_daily_hours.items():
            max_hours = self.faculty_max_hours.get(fac_id, 4)
            self.model.Add(sum(dur * var for dur, var in items) <= max_hours)

