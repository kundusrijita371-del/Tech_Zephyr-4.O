"""Room matching and availability engine for Spectra Week venue bookings.

Verifies:
1. Allowed event usage ("event" in room.allowed_uses).
2. Room type matches requested room types.
3. Normal room capacity >= requested attendance.
4. Feature and accessibility satisfaction (accessible room adds "accessible" feature).
5. Room maintenance / unavailability windows.
6. Base timetable session conflicts.
7. Previously allocated booking conflicts.
8. Mandatory student group class conflicts.
"""

from __future__ import annotations

from typing import Any
from collections import defaultdict

from app.models.booking import BookingWindow, RoomCompatibilityInfo, SlotOption
from app.models.dataset import Dataset, Room


class BookingMatcher:
    """Matches rooms and evaluates slot availability for booking requests."""

    MAX_PERIOD = 13

    def __init__(
        self,
        dataset: Dataset,
        base_timetable: dict[str, tuple[str, int, str]],
    ) -> None:
        """Initialize matcher with dataset and base timetable assignments.

        Args:
            dataset: Validated Dataset instance.
            base_timetable: Mapping of session_id -> (day, start_period, room_id).
        """
        self.dataset = dataset
        self.days = dataset.calendar.days
        self.rooms: dict[str, Room] = {r.id: r for r in dataset.rooms}
        self.sessions = {s.id: s for s in dataset.sessions}

        # Precompute room maintenance windows: (room_id, day) -> set of unavailable periods
        self.room_un: dict[tuple[str, str], set[int]] = defaultdict(set)
        for u in dataset.room_unavailability:
            for p in u.periods:
                self.room_un[(u.room_id, u.day)].add(p)

        # Precompute student group class schedule from base timetable: (group_id, day, period) -> session_id
        self.group_schedule: dict[tuple[str, str, int], str] = {}
        # Precompute room class schedule from base timetable: (room_id, day, period) -> session_id
        self.room_timetable: dict[tuple[str, str, int], str] = {}

        for sid, (day, start, rid) in base_timetable.items():
            session = self.sessions.get(sid)
            if not session:
                continue
            for p in range(start, start + session.duration):
                self.room_timetable[(rid, day, p)] = sid
                for g in session.groups:
                    self.group_schedule[(g, day, p)] = sid

        # Dynamic booking occupancy: (room_id, day, period) -> list of booking request IDs
        self.booking_occupancy: dict[tuple[str, str, int], list[str]] = defaultdict(list)

    def evaluate_room_compatibility(
        self,
        room: Room,
        attendance: int,
        room_types: list[str],
        needs: list[str],
    ) -> RoomCompatibilityInfo:
        """Evaluate static compatibility of a single room for an event request."""
        event_allowed = "event" in room.allowed_uses
        type_ok = room.type in room_types
        capacity_ok = room.capacity >= attendance

        room_features = set(room.features)
        if room.accessible:
            room_features.add("accessible")

        missing_features = sorted(list(set(needs) - room_features))
        is_compatible = event_allowed and type_ok and capacity_ok and len(missing_features) == 0

        return RoomCompatibilityInfo(
            room_id=room.id,
            room_name=room.name,
            room_type=room.type,
            capacity=room.capacity,
            is_compatible=is_compatible,
            missing_features=missing_features,
            capacity_ok=capacity_ok,
            type_ok=type_ok,
            event_allowed=event_allowed,
        )

    def get_compatible_rooms(
        self,
        attendance: int,
        room_types: list[str],
        needs: list[str],
        preferred_room_id: str | None = None,
    ) -> list[Room]:
        """Return list of compatible rooms sorted with preferred room first, then by capacity ascending."""
        compatible: list[Room] = []
        for room in self.rooms.values():
            info = self.evaluate_room_compatibility(room, attendance, room_types, needs)
            if info.is_compatible:
                compatible.append(room)

        # Sorting: preferred room first (0), then lowest capacity that fits to keep large halls free
        def sort_key(r: Room) -> tuple[int, int]:
            is_pref = 0 if (preferred_room_id and r.id == preferred_room_id) else 1
            return (is_pref, r.capacity)

        compatible.sort(key=sort_key)
        return compatible

    def is_slot_available(
        self,
        room_id: str,
        day: str,
        start_period: int,
        end_period: int,
        mandatory_groups: list[str],
        ignore_request_id: str | None = None,
    ) -> tuple[bool, str]:
        """Check if a specific room, day, and period range has no clashes.

        Returns (is_available, conflict_reason).
        """
        if day not in self.days:
            return False, f"Invalid day {day}"

        if start_period < 1 or end_period > self.MAX_PERIOD or end_period < start_period:
            return False, f"Invalid periods P{start_period}-P{end_period} (max period is {self.MAX_PERIOD})"

        periods = list(range(start_period, end_period + 1))

        # 1. Maintenance unavailability
        for p in periods:
            if p in self.room_un.get((room_id, day), set()):
                return False, f"Room {room_id} unavailable for maintenance on {day} P{p}"

        # 2. Timetable class clash
        for p in periods:
            sid = self.room_timetable.get((room_id, day, p))
            if sid:
                return False, f"Room {room_id} occupied by class {sid} on {day} P{p}"

        # 3. Booking clash
        for p in periods:
            existing = self.booking_occupancy.get((room_id, day, p), [])
            clashing = [req_id for req_id in existing if req_id != ignore_request_id]
            if clashing:
                return False, f"Room {room_id} already booked by {', '.join(clashing)} on {day} P{p}"

        # 4. Mandatory student group clash
        for g in mandatory_groups:
            for p in periods:
                sid = self.group_schedule.get((g, day, p))
                if sid:
                    return False, f"Mandatory student group {g} has scheduled class {sid} on {day} P{p}"

        return True, ""

    def find_slot_in_windows(
        self,
        windows: list[BookingWindow],
        duration_periods: int,
        compatible_rooms: list[Room],
        mandatory_groups: list[str],
        preferred_room_id: str | None = None,
    ) -> tuple[Room, str, int, int] | None:
        """Find the best available slot completely within the requested windows.

        Returns (room, day, start_period, end_period) or None.
        """
        for w in windows:
            day = w.day
            from_p = w.from_period
            to_p = w.to_period

            for s0 in range(from_p, to_p - duration_periods + 2):
                end_p = s0 + duration_periods - 1
                if end_p > self.MAX_PERIOD:
                    continue

                for room in compatible_rooms:
                    ok, _ = self.is_slot_available(room.id, day, s0, end_p, mandatory_groups)
                    if ok:
                        return room, day, s0, end_p

        return None

    def find_alternative_slot(
        self,
        duration_periods: int,
        compatible_rooms: list[Room],
        mandatory_groups: list[str],
        preferred_room_id: str | None = None,
        preferred_days: list[str] | None = None,
    ) -> tuple[Room, str, int, int] | None:
        """Find an alternative available slot outside the requested windows or in another venue.

        Prioritizes evening event periods (P10-P13) and preferred days first.
        """
        search_days = (preferred_days or []) + [d for d in self.days if d not in (preferred_days or [])]

        # Order periods: evening periods first (P10 to P13) where classes don't run, then daytime
        evening_starts = [p for p in range(10, self.MAX_PERIOD - duration_periods + 2)]
        day_starts = [p for p in range(1, 10 - duration_periods + 2)]
        candidate_starts = evening_starts + day_starts

        for day in search_days:
            for s0 in candidate_starts:
                end_p = s0 + duration_periods - 1
                if end_p > self.MAX_PERIOD:
                    continue

                for room in compatible_rooms:
                    ok, _ = self.is_slot_available(room.id, day, s0, end_p, mandatory_groups)
                    if ok:
                        return room, day, s0, end_p

        return None

    def record_booking(self, request_id: str, room_id: str, day: str, start_period: int, end_period: int) -> None:
        """Mark periods as occupied by an allocated booking."""
        for p in range(start_period, end_period + 1):
            self.booking_occupancy[(room_id, day, p)].append(request_id)

    def release_booking(self, request_id: str, room_id: str, day: str, start_period: int, end_period: int) -> None:
        """Release periods previously occupied by a booking."""
        for p in range(start_period, end_period + 1):
            if request_id in self.booking_occupancy[(room_id, day, p)]:
                self.booking_occupancy[(room_id, day, p)].remove(request_id)

