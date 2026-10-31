"""Candidate placement generator for CIT timetable sessions.

Generates feasible (day, start_period, room) placements for each session,
filtering out placements that violate hard domain constraints:
  - Valid teaching days (MON-FRI)
  - Valid teaching periods (P1 to P9)
  - Lunch boundary crossing (cannot span P5 and P6)
  - Lab start constraints (labs of duration 3 must start at P2 or P6)
  - Room type compatibility
  - Room capacity >= session size
  - Accessibility requirements
  - Faculty unavailability periods
  - Room maintenance/unavailability periods
  - Fixed session slots
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.models.dataset import Dataset, Faculty, Room, Session


@dataclass(frozen=True)
class CandidatePlacement:
    """A feasible candidate placement for a session."""
    session_id: str
    day: str
    start_period: int
    room_id: str
    duration: int
    periods: list[int] = field(default_factory=list)

    # Precalculated candidate-level soft penalties
    cost_s1: int = 0  # Faculty avoid preferences (2 pts per hour)
    cost_s5: int = 0  # Low room utilisation (< 40% capacity, 1 pt)
    cost_s6: int = 0  # Teaching period 9 usage (1 pt)

    @property
    def time_slot_key(self) -> tuple[str, int]:
        """Key for day and start period."""
        return (self.day, self.start_period)


@dataclass
class CandidateDiagnostic:
    """Diagnostic information if a session has limited or no feasible candidates."""
    session_id: str
    reasons: list[str] = field(default_factory=list)


class CandidateGenerator:
    """Generates and filters feasible placement candidates for all sessions."""

    def __init__(self, dataset: Dataset) -> None:
        self.dataset = dataset
        self.calendar = dataset.calendar
        self.teaching_days = list(self.calendar.days)
        self.teaching_periods = [
            p.id for p in self.calendar.periods if p.teaching
        ]
        self.last_teaching_period = max(self.teaching_periods) if self.teaching_periods else 9
        self.lunch_after_period = self.calendar.lunch.after_period  # 5
        self.lab_start_periods = set(self.calendar.lab_start_periods)  # {2, 6}

        self.rooms: dict[str, Room] = {r.id: r for r in dataset.rooms}
        self.faculty: dict[str, Faculty] = {f.id: f for f in dataset.faculty}

        # Precompute unavailability lookups
        self.faculty_unavail: set[tuple[str, str, int]] = set()
        for f in dataset.faculty:
            for u in f.unavailable:
                for p in u.periods:
                    self.faculty_unavail.add((f.id, u.day, p))

        self.room_unavail: set[tuple[str, str, int]] = set()
        for u in dataset.room_unavailability:
            for p in u.periods:
                self.room_unavail.add((u.room_id, u.day, p))

        # Precompute faculty avoid preference windows
        self.faculty_avoids: dict[str, list[tuple[set[str], set[int]]]] = {}
        for f in dataset.faculty:
            avoids: list[tuple[set[str], set[int]]] = []
            for pref in f.preferences:
                if pref.type == "avoid":
                    days_set = set(pref.days) if pref.days else set(self.teaching_days)
                    periods_set = set(pref.periods)
                    avoids.append((days_set, periods_set))
            if avoids:
                self.faculty_avoids[f.id] = avoids

    def get_time_slots_for_session(
        self, session: Session
    ) -> list[tuple[str, int, list[int]]]:
        """Generate all geometrically valid (day, start, periods) slots for a session."""
        slots: list[tuple[str, int, list[int]]] = []
        dur = session.duration

        # If session has a fixed slot, restrict directly
        if session.fixed_slot:
            fx_day = session.fixed_slot.day
            fx_start = session.fixed_slot.start_period
            pers = list(range(fx_start, fx_start + dur))
            return [(fx_day, fx_start, pers)]

        for day in self.teaching_days:
            # Teaching periods are 1..last_teaching_period
            for start in range(1, self.last_teaching_period - dur + 2):
                pers = list(range(start, start + dur))
                # H9 check: cannot run outside P1-P9
                if pers[-1] > self.last_teaching_period:
                    continue
                # H9 check: cannot cross lunch (pers[0] <= lunch < pers[-1])
                if pers[0] <= self.lunch_after_period < pers[-1]:
                    continue
                # H9 check: lab must start at P2 or P6
                if session.kind == "lab" and start not in self.lab_start_periods:
                    continue
                # H7 check: faculty cannot be unavailable during these periods
                if any(
                    (session.faculty_id, day, p) in self.faculty_unavail
                    for p in pers
                ):
                    continue

                slots.append((day, start, pers))

        return slots

    def get_compatible_rooms(self, session: Session) -> list[Room]:
        """Find all rooms matching type, capacity, and accessibility requirements."""
        compatible: list[Room] = []
        for room in self.rooms.values():
            # H6: Room type must match
            if room.type not in session.room_types:
                continue
            # H5: Room capacity must be >= session size
            if room.capacity < session.size:
                continue
            # H10: Accessible session needs accessible room
            if session.needs_accessible and not room.accessible:
                continue
            compatible.append(room)
        return compatible

    def compute_soft_penalties(
        self,
        session: Session,
        room: Room,
        day: str,
        periods: list[int],
    ) -> tuple[int, int, int]:
        """Precalculate candidate-level soft penalties (S1, S5, S6)."""
        # S1: Faculty avoid preference hours * 2
        cost_s1 = 0
        if session.faculty_id in self.faculty_avoids:
            for days_set, periods_set in self.faculty_avoids[session.faculty_id]:
                if day in days_set:
                    overlap_hours = sum(1 for p in periods if p in periods_set)
                    cost_s1 += 2 * overlap_hours

        # S5: Room utilisation below 40% (1 pt)
        cost_s5 = 0
        if room.capacity > 0 and (session.size / room.capacity) < 0.4:
            cost_s5 = 1

        # S6: Uses period 9 (1 pt)
        cost_s6 = 1 if self.last_teaching_period in periods else 0

        return cost_s1, cost_s5, cost_s6

    def generate_candidates_for_session(
        self, session: Session
    ) -> tuple[list[CandidatePlacement], CandidateDiagnostic]:
        """Generate all candidate placements for a single session."""
        diagnostic = CandidateDiagnostic(session_id=session.id)
        time_slots = self.get_time_slots_for_session(session)
        compatible_rooms = self.get_compatible_rooms(session)

        if not time_slots:
            diagnostic.reasons.append(
                f"No feasible time slots (duration={session.duration}, kind={session.kind}, "
                f"faculty={session.faculty_id} availability, lunch boundaries)"
            )
        if not compatible_rooms:
            diagnostic.reasons.append(
                f"No compatible rooms (types={session.room_types}, size={session.size}, "
                f"accessible={session.needs_accessible})"
            )

        candidates: list[CandidatePlacement] = []
        dur = session.duration

        for day, start, pers in time_slots:
            for room in compatible_rooms:
                # H8: Room maintenance/unavailability check
                if any((room.id, day, p) in self.room_unavail for p in pers):
                    continue

                c_s1, c_s5, c_s6 = self.compute_soft_penalties(
                    session, room, day, pers
                )

                candidates.append(
                    CandidatePlacement(
                        session_id=session.id,
                        day=day,
                        start_period=start,
                        room_id=room.id,
                        duration=dur,
                        periods=pers,
                        cost_s1=c_s1,
                        cost_s5=c_s5,
                        cost_s6=c_s6,
                    )
                )

        if not candidates and not diagnostic.reasons:
            diagnostic.reasons.append(
                "All combinations eliminated by room unavailability windows."
            )

        return candidates, diagnostic

    def generate_all(
        self,
    ) -> tuple[dict[str, list[CandidatePlacement]], dict[str, CandidateDiagnostic]]:
        """Generate candidates for all 189 sessions."""
        all_candidates: dict[str, list[CandidatePlacement]] = {}
        diagnostics: dict[str, CandidateDiagnostic] = {}

        for session in self.dataset.sessions:
            cands, diag = self.generate_candidates_for_session(session)
            all_candidates[session.id] = cands
            if not cands or diag.reasons:
                diagnostics[session.id] = diag

        return all_candidates, diagnostics

