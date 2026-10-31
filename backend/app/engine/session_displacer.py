"""Session displacement engine for approved institute events during Spectra Week (Week 7).

Rules:
- Only approved institute_events may displace a regular teaching session (Rule B2).
- Never drop a displaced session; it must be rescheduled to a valid clash-free slot.
- Rescheduled session must satisfy:
    1. Teaching day (MON to FRI).
    2. Teaching periods (1 to 9).
    3. Respect session duration.
    4. Must not cross lunch (between P5 and P6).
    5. 3-hour labs must start at P2 or P6.
    6. Room capacity >= session size.
    7. Room type and kind compatibility.
    8. Room accessibility for student groups.
    9. Faculty availability and max daily teaching hours.
    10. No student group or room double-bookings.
- Preserves all unaffected sessions.
"""

from __future__ import annotations

import logging
from typing import Any

from app.models.booking import SessionOverride
from app.models.dataset import Dataset, Session
from app.services.validation_service import _STARTER_PACK_DIR

import sys
if str(_STARTER_PACK_DIR) not in sys.path:
    sys.path.insert(0, str(_STARTER_PACK_DIR))
import validator

logger = logging.getLogger(__name__)


class SessionDisplacementEngine:
    """Finds valid relocations for timetable sessions displaced by institute events."""

    def __init__(
        self,
        dataset: Dataset,
        base_timetable: dict[str, tuple[str, int, str]],
    ) -> None:
        self.dataset = dataset
        self.base_timetable = dict(base_timetable)
        self.ctx = validator.Ctx(dataset.model_dump())
        self.sessions: dict[str, Session] = {s.id: s for s in dataset.sessions}

    def can_displace(self, effective_category: str) -> bool:
        """Check if an event category has authority to displace regular classes."""
        order = self.dataset.priority_order
        inst_idx = order.index("institute_event")
        eff_idx = order.index(effective_category) if effective_category in order else len(order) - 1
        return eff_idx <= inst_idx

    def find_session_repair(
        self,
        session_id: str,
        current_week: dict[str, tuple[str, int, str]],
        displaced_by_req_id: str,
        busy_rooms_by_events: dict[tuple[str, str, int], list[str]],
    ) -> SessionOverride | None:
        """Find a feasible relocation for session_id in current_week that passes check_timetable."""
        session = self.sessions.get(session_id)
        if not session:
            return None

        dur = session.duration
        lunch_after = self.dataset.calendar.lunch.after_period
        lab_starts = set(self.dataset.calendar.lab_start_periods)
        teaching_days = self.dataset.calendar.days
        valid_rooms = [
            r for r in self.dataset.rooms
            if r.capacity >= session.size and session.kind in r.allowed_uses
        ]

        # Prioritize keeping same day or same room if possible
        orig_day, orig_start, orig_room = current_week[session_id]

        candidate_days = [orig_day] + [d for d in teaching_days if d != orig_day]

        for day in candidate_days:
            # Regular classes must use P1 to P9
            for s0 in range(1, 10 - dur + 1):
                end_p = s0 + dur - 1

                # Check lunch restriction
                if s0 <= lunch_after and end_p > lunch_after:
                    continue

                # Check 3-hour lab start restrictions
                if dur == 3 and s0 not in lab_starts:
                    continue

                for room in valid_rooms:
                    # Check accessibility
                    if session.requires_accessible and not room.accessible:
                        continue

                    # Check room type match
                    if session.room_type and room.type != session.room_type:
                        continue

                    # Check event clash
                    event_clash = any(
                        busy_rooms_by_events.get((room.id, day, p))
                        for p in range(s0, end_p + 1)
                    )
                    if event_clash:
                        continue

                    # Trial candidate in week timetable
                    trial_week = dict(current_week)
                    trial_week[session_id] = (day, s0, room.id)

                    violations, _ = validator.check_timetable(self.ctx, trial_week, "fest_week_trial")
                    if len(violations) == 0:
                        return SessionOverride(
                            session_id=session_id,
                            day=day,
                            start_period=s0,
                            room_id=room.id,
                            displaced_by=displaced_by_req_id,
                        )

        return None

