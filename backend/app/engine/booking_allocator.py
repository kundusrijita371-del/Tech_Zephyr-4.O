"""Deterministic, priority-aware venue booking allocation engine for Spectra Week.

Processes all 25 booking requests in strict priority order:
1. Higher effective priority first (applying role caps).
2. Earlier submitted_at first on tie.
3. Automatically rejects cancelled requests with official note.
4. Prefers requested_room where valid.
5. Prefers capacity efficiency without violating hard rules.
6. Generates valid alternative_offered slots when windows or preferred rooms clash.
7. Evaluates institute_event session displacement when classes overlap.
8. Prevents priority inversions.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

from app.engine.booking_matcher import BookingMatcher
from app.engine.booking_priority import get_effective_category, sort_requests_by_priority
from app.engine.session_displacer import SessionDisplacementEngine
from app.models.booking import (
    BookingDecision,
    FestWeekSchedule,
    SessionOverride,
)
from app.models.dataset import BookingRequest, Dataset
from app.services.validation_service import BookingValidator

logger = logging.getLogger(__name__)


class BookingAllocator:
    """Allocates campus venues for Spectra Week booking requests."""

    def __init__(
        self,
        dataset: Dataset,
        base_timetable: dict[str, tuple[str, int, str]],
    ) -> None:
        self.dataset = dataset
        self.base_timetable = dict(base_timetable)
        self.matcher = BookingMatcher(dataset, base_timetable)
        self.displacer = SessionDisplacementEngine(dataset, base_timetable)
        self.cancelled_map = {
            c.request_id: c.note for c in self.dataset.cancellations
        }

    def allocate_all(self) -> tuple[FestWeekSchedule, dict[str, Any]]:
        """Run deterministic priority-driven allocation for all 25 requests."""
        # 1. Sort all original booking requests by priority
        sorted_requests: list[BookingRequest] = sort_requests_by_priority(
            self.dataset, self.dataset.booking_requests
        )

        decisions: list[BookingDecision] = []
        session_overrides: list[SessionOverride] = []
        current_week_timetable = dict(self.base_timetable)

        for req in sorted_requests:
            req_id = req.id
            eff_cat = get_effective_category(self.dataset, req)

            # Rule B3: Cancelled requests must never be approved or offered as alternatives
            if req_id in self.cancelled_map:
                canc_note = self.cancelled_map[req_id]
                decisions.append(
                    BookingDecision(
                        request_id=req_id,
                        status="rejected",
                        reason=f"Request cancelled: {canc_note}",
                    )
                )
                continue

            # Step 4: Find compatible rooms
            compatible_rooms = self.matcher.get_compatible_rooms(
                attendance=req.attendance,
                room_types=req.room_types,
                needs=req.needs,
                preferred_room_id=req.requested_room,
            )

            if not compatible_rooms:
                max_campus_capacity = max(r.capacity for r in self.dataset.rooms)
                if req.attendance > max_campus_capacity:
                    reason = f"No venue on campus seats {req.attendance} (largest venue seats {max_campus_capacity})"
                else:
                    reason = f"No venue matches requested types {req.room_types} and needs {req.needs} with capacity >= {req.attendance}"

                decisions.append(
                    BookingDecision(
                        request_id=req_id,
                        status="rejected",
                        reason=reason,
                    )
                )
                continue

            # Step 5 & 6: Search for slot inside requested windows
            found_slot = self.matcher.find_slot_in_windows(
                windows=req.windows,
                duration_periods=req.duration_periods,
                compatible_rooms=compatible_rooms,
                mandatory_groups=req.mandatory_for_groups,
                preferred_room_id=req.requested_room,
            )

            # If not directly free, check if session displacement is permissible for institute_events
            if found_slot is None and self.displacer.can_displace(eff_cat):
                for w in req.windows:
                    day = w.day
                    from_p = w.from_period
                    to_p = w.to_period
                    dur = req.duration_periods

                    for s0 in range(from_p, to_p - dur + 2):
                        end_p = s0 + dur - 1
                        if end_p > self.matcher.MAX_PERIOD:
                            continue

                        for room in compatible_rooms:
                            # Check if clash is purely with regular classes
                            clashing_sessions = []
                            other_clash = False
                            for p in range(s0, end_p + 1):
                                sid = self.matcher.room_timetable.get((room.id, day, p))
                                if sid:
                                    clashing_sessions.append(sid)
                                # Maintenance or booking clash
                                if p in self.matcher.room_un.get((room.id, day), set()):
                                    other_clash = True
                                if self.matcher.booking_occupancy.get((room.id, day, p)):
                                    other_clash = True

                            if not other_clash and clashing_sessions:
                                # Attempt to displace the clashing sessions
                                all_repaired = True
                                trial_overrides: list[SessionOverride] = []
                                trial_week = dict(current_week_timetable)

                                for csid in clashing_sessions:
                                    override = self.displacer.find_session_repair(
                                        session_id=csid,
                                        current_week=trial_week,
                                        displaced_by_req_id=req_id,
                                        busy_rooms_by_events=self.matcher.booking_occupancy,
                                    )
                                    if override:
                                        trial_overrides.append(override)
                                        trial_week[csid] = (override.day, override.start_period, override.room_id)
                                    else:
                                        all_repaired = False
                                        break

                                if all_repaired:
                                    session_overrides.extend(trial_overrides)
                                    current_week_timetable = trial_week
                                    found_slot = (room, day, s0, end_p)
                                    break
                        if found_slot:
                            break
                    if found_slot:
                        break

            if found_slot:
                room, day, a, b = found_slot
                self.matcher.record_booking(req_id, room.id, day, a, b)
                decisions.append(
                    BookingDecision(
                        request_id=req_id,
                        status="approved",
                        day=day,
                        start_period=a,
                        end_period=b,
                        room_id=room.id,
                        reason=f"Approved in {room.id} on {day} P{a}-P{b}",
                    )
                )
                continue

            # Step 7: Search for alternative suggestion
            requested_days = [w.day for w in req.windows]
            alt_slot = self.matcher.find_alternative_slot(
                duration_periods=req.duration_periods,
                compatible_rooms=compatible_rooms,
                mandatory_groups=req.mandatory_for_groups,
                preferred_room_id=req.requested_room,
                preferred_days=requested_days,
            )

            if alt_slot:
                room, day, a, b = alt_slot
                self.matcher.record_booking(req_id, room.id, day, a, b)

                # Generate informative reason
                if any(w.to_period > self.matcher.MAX_PERIOD for w in req.windows):
                    reason = f"Requested period exceeds campus operating hours (max period {self.matcher.MAX_PERIOD}); alternative offered in {room.id} {day} P{a}-P{b}"
                elif req.requested_room and room.id != req.requested_room:
                    reason = f"Preferred venue {req.requested_room} unavailable due to higher priority allocation; alternative offered in {room.id} {day} P{a}-P{b}"
                else:
                    reason = f"Requested window unavailable due to scheduling conflicts; alternative offered in {room.id} {day} P{a}-P{b}"

                decisions.append(
                    BookingDecision(
                        request_id=req_id,
                        status="alternative_offered",
                        day=day,
                        start_period=a,
                        end_period=b,
                        room_id=room.id,
                        reason=reason,
                    )
                )
            else:
                # Rejection
                decisions.append(
                    BookingDecision(
                        request_id=req_id,
                        status="rejected",
                        reason=f"No compatible venue available without clash during or outside requested windows for attendance {req.attendance}",
                    )
                )

        schedule = FestWeekSchedule(
            bookings=decisions,
            session_overrides=session_overrides,
        )

        # Official validator verification
        val_report = BookingValidator.validate_fest_week(
            self.dataset, self.base_timetable, schedule
        )

        return schedule, val_report

