"""Impact analyzer for campus disruptions.

Identifies directly and indirectly impacted teaching sessions, midsem examinations,
and fest venue bookings resulting from room outages, faculty emergencies, or maintenance.
"""

from __future__ import annotations

from typing import Any

from app.models.dataset import Dataset, Session
from app.models.disruption import DisruptionItem, DisruptionRequest
from app.models.rescheduling import AffectedActivity, ImpactReport


class ImpactAnalyzer:
    """Analyzes the operational cascade of campus disruptions on an active schedule."""

    def __init__(self, dataset: Dataset, current_schedule: dict[str, Any]) -> None:
        self.dataset = dataset
        self.current_schedule = current_schedule
        self.sessions_by_id: dict[str, Session] = {s.id: s for s in dataset.sessions}
        self.rooms_by_id = {r.id: r for r in dataset.rooms}
        self.faculty_by_id = {f.id: f for f in dataset.faculty}

        # Basket map: basket_slot -> list[Session]
        self.baskets: dict[str, list[Session]] = {}
        for s in dataset.sessions:
            if s.basket_slot:
                self.baskets.setdefault(s.basket_slot, []).append(s)

    def analyze(self, disruption: DisruptionRequest) -> ImpactReport:
        """Evaluate the full blast radius of a disruption request."""
        items: list[DisruptionItem] = disruption.get_all_disruption_items()

        directly_affected: list[AffectedActivity] = []
        indirectly_affected: list[AffectedActivity] = []
        affected_rooms: set[str] = set()
        affected_faculty: set[str] = set()
        affected_groups: set[str] = set()
        affected_periods_str: set[str] = set()

        direct_session_ids: set[str] = set()
        direct_exam_ids: set[str] = set()
        direct_booking_ids: set[str] = set()

        sessions_data = self.current_schedule.get("sessions", [])

        # 1. Analyze Timetable Sessions
        for s_entry in sessions_data:
            sid = s_entry.get("session_id")
            s_obj = self.sessions_by_id.get(sid)
            if not s_obj:
                continue

            s_day = s_entry.get("day")
            s_start = s_entry.get("start_period", 1)
            s_room = s_entry.get("room_id")
            s_periods = list(range(s_start, s_start + s_obj.duration))

            # Test against all disruption items
            for item in items:
                if s_day not in item.affected_days:
                    continue

                disrupted_periods = set(range(item.start_period, item.end_period + 1))
                overlap = set(s_periods).intersection(disrupted_periods)
                if not overlap:
                    continue

                is_room_hit = item.resource_id == s_room
                is_fac_hit = item.resource_id == s_obj.faculty_id

                if is_room_hit or is_fac_hit:
                    direct_session_ids.add(sid)
                    impact_nature = (
                        "direct_room_conflict" if is_room_hit else "direct_faculty_conflict"
                    )
                    directly_affected.append(
                        AffectedActivity(
                            activity_type="session",
                            activity_id=sid,
                            course_or_title=s_obj.course_id,
                            current_day=s_day,
                            current_start_period=s_start,
                            current_duration=s_obj.duration,
                            current_rooms=[s_room],
                            faculty_id=s_obj.faculty_id,
                            student_groups=s_obj.groups,
                            impact_nature=impact_nature,
                        )
                    )
                    affected_rooms.add(s_room)
                    affected_faculty.add(s_obj.faculty_id)
                    affected_groups.update(s_obj.groups)
                    for p in s_periods:
                        affected_periods_str.add(f"{s_day}-P{p}")
                    break

        # 2. Identify Elective Basket Cascades (Indirect Impact)
        for sid in list(direct_session_ids):
            s_obj = self.sessions_by_id.get(sid)
            if s_obj and s_obj.basket_slot:
                b_peers = self.baskets.get(s_obj.basket_slot, [])
                for peer in b_peers:
                    if peer.id != sid and peer.id not in direct_session_ids:
                        # Find peer's current schedule entry
                        peer_entry = next(
                            (x for x in sessions_data if x.get("session_id") == peer.id),
                            None,
                        )
                        if peer_entry:
                            p_day = peer_entry.get("day")
                            p_start = peer_entry.get("start_period")
                            p_room = peer_entry.get("room_id")
                            indirectly_affected.append(
                                AffectedActivity(
                                    activity_type="session",
                                    activity_id=peer.id,
                                    course_or_title=peer.course_id,
                                    current_day=p_day,
                                    current_start_period=p_start,
                                    current_duration=peer.duration,
                                    current_rooms=[p_room],
                                    faculty_id=peer.faculty_id,
                                    student_groups=peer.groups,
                                    impact_nature="basket_synchronization_cascade",
                                )
                            )
                            affected_faculty.add(peer.faculty_id)
                            affected_groups.update(peer.groups)

        # 3. Analyze Examinations
        exams_data = self.current_schedule.get("exams", [])
        for ex in exams_data:
            ex_id = ex.get("exam_id")
            ex_day = ex.get("day")
            ex_session = ex.get("session")  # "AM" or "PM"
            ex_rooms = ex.get("rooms", [])

            # Check if any item affects exam rooms
            for item in items:
                if ex_day in item.affected_days:
                    if item.resource_id in ex_rooms:
                        direct_exam_ids.add(ex_id)
                        directly_affected.append(
                            AffectedActivity(
                                activity_type="exam",
                                activity_id=ex_id,
                                course_or_title=ex.get("course_id", ex_id),
                                current_day=ex_day,
                                current_start_period=ex_session,
                                current_duration=3,
                                current_rooms=ex_rooms,
                                faculty_id=None,
                                student_groups=[],
                                impact_nature="direct_room_conflict",
                            )
                        )
                        affected_rooms.update(ex_rooms)
                        affected_periods_str.add(f"{ex_day}-{ex_session}")
                        break

        # 4. Analyze Fest Bookings
        fest_bookings = (
            self.current_schedule.get("fest_week", {}).get("bookings", [])
        )
        for b_entry in fest_bookings:
            if b_entry.get("status") != "approved":
                continue
            b_id = b_entry.get("request_id")
            b_day = b_entry.get("day")
            b_start = b_entry.get("start_period", 1)
            b_end = b_entry.get("end_period", b_start)
            b_room = b_entry.get("room_id")
            b_periods = set(range(b_start, b_end + 1))

            for item in items:
                if b_day in item.affected_days:
                    disrupted_periods = set(range(item.start_period, item.end_period + 1))
                    if item.resource_id == b_room and b_periods.intersection(disrupted_periods):
                        direct_booking_ids.add(b_id)
                        directly_affected.append(
                            AffectedActivity(
                                activity_type="booking",
                                activity_id=b_id,
                                course_or_title=b_id,
                                current_day=b_day,
                                current_start_period=b_start,
                                current_duration=len(b_periods),
                                current_rooms=[b_room] if b_room else [],
                                faculty_id=None,
                                student_groups=[],
                                impact_nature="direct_room_conflict",
                            )
                        )
                        if b_room:
                            affected_rooms.add(b_room)
                        affected_periods_str.add(f"{b_day}-P{b_start}..P{b_end}")
                        break

        total_req = len(directly_affected) + len(indirectly_affected)
        diagnostic = (
            f"Disruption {disruption.disruption_id} affects {len(directly_affected)} activities directly "
            f"and {len(indirectly_affected)} activities indirectly across {len(affected_rooms)} rooms "
            f"and {len(affected_faculty)} faculty members."
        )

        return ImpactReport(
            disruption_id=disruption.disruption_id,
            disruption_type=disruption.disruption_type.value,
            reported_by=disruption.reported_by,
            affected_days=disruption.affected_days,
            directly_affected_activities=directly_affected,
            indirectly_affected_activities=indirectly_affected,
            affected_rooms=sorted(list(affected_rooms)),
            affected_faculty=sorted(list(affected_faculty)),
            affected_student_groups=sorted(list(affected_groups)),
            affected_dates_and_periods=sorted(list(affected_periods_str)),
            total_activities_requiring_repair=total_req,
            diagnostic_summary=diagnostic,
        )

