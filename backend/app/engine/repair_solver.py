"""CP-SAT timetable repair solver for campus disruption management.

Solves the schedule repair problem starting from the existing baseline schedule,
enforcing all official hard constraints and optimizing for minimal change stability.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from ortools.sat.python import cp_model

from app.engine.impact_analyzer import ImpactAnalyzer
from app.engine.repair_candidates import RepairCandidateGenerator, RepairPlacement
from app.models.dataset import Dataset, Session
from app.models.disruption import DisruptionRequest, DisruptionType
from app.models.rescheduling import (
    BookingChange,
    ExamChange,
    ImpactReport,
    SessionChange,
)

logger = logging.getLogger(__name__)


@dataclass
class RepairResult:
    """Outcome of the schedule repair engine."""
    status: str  # "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN"
    is_success: bool
    solve_time_seconds: float
    impact_report: ImpactReport
    repaired_schedule: dict[str, Any] = field(default_factory=dict)
    changed_sessions: list[SessionChange] = field(default_factory=list)
    changed_exams: list[ExamChange] = field(default_factory=list)
    changed_bookings: list[BookingChange] = field(default_factory=list)
    unresolved_activities: list[str] = field(default_factory=list)
    diagnostics: list[str] = field(default_factory=list)


class RepairSolver:
    """Deterministic schedule repair engine using Google OR-Tools CP-SAT."""

    def __init__(
        self,
        dataset: Dataset,
        baseline_schedule: dict[str, Any],
        disruption: DisruptionRequest,
    ) -> None:
        self.dataset = dataset
        self.baseline_schedule = baseline_schedule
        self.disruption = disruption
        self.sessions_by_id: dict[str, Session] = {s.id: s for s in dataset.sessions}

        # Baseline timetable lookup: session_id -> (day, start, room)
        self.baseline_timetable: dict[str, tuple[str, int, str]] = {
            s["session_id"]: (s["day"], s["start_period"], s["room_id"])
            for s in baseline_schedule.get("sessions", [])
            if "session_id" in s
        }

    def solve(self, time_limit_seconds: float = 15.0, num_workers: int = 8) -> RepairResult:
        """Execute impact analysis, formulate CP-SAT repair model, and solve."""
        start_time = time.perf_counter()

        # 1. Apply disruption to dataset
        changes = self.disruption.to_official_changes()
        disruption_dict = {
            "id": self.disruption.disruption_id,
            "dataset": self.dataset.dataset_id,
            "changes": changes,
        }
        from app.services.validation_service import validator
        disrupted_raw = validator.apply_disruption(self.dataset.model_dump(), disruption_dict)
        self.disrupted_dataset = Dataset.model_validate(disrupted_raw)
        self.sessions_by_id = {s.id: s for s in self.disrupted_dataset.sessions}

        # 2. Run Impact Analysis
        analyzer = ImpactAnalyzer(self.disrupted_dataset, self.baseline_schedule)
        impact = analyzer.analyze(self.disruption)

        affected_session_ids = {
            a.activity_id
            for a in (impact.directly_affected_activities + impact.indirectly_affected_activities)
            if a.activity_type == "session"
        }

        # 3. Generate Repair Candidates
        cand_generator = RepairCandidateGenerator(
            dataset=self.disrupted_dataset,
            baseline_timetable=self.baseline_timetable,
            affected_session_ids=affected_session_ids,
        )
        candidates, diags = cand_generator.generate_all()

        unplannable = [sid for sid, cands in candidates.items() if not cands]
        if unplannable:
            dur = time.perf_counter() - start_time
            return RepairResult(
                status="INFEASIBLE",
                is_success=False,
                solve_time_seconds=dur,
                impact_report=impact,
                unresolved_activities=unplannable,
                diagnostics=[f"No feasible candidate placement for session {s}" for s in unplannable],
            )

        # 3. Formulate CP-SAT Model
        model = cp_model.CpModel()
        x_vars: dict[tuple[str, int], cp_model.IntVar] = {}

        # Elective baskets mapping
        baskets: dict[str, list[Session]] = defaultdict(list)
        for s in self.disrupted_dataset.sessions:
            if s.basket_slot:
                baskets[s.basket_slot].append(s)

        # Basket time variables
        basket_time_vars: dict[tuple[str, str, int], cp_model.IntVar] = {}
        for b_id, b_sessions in baskets.items():
            dur = b_sessions[0].duration
            for day in self.disrupted_dataset.calendar.days:
                for start in range(1, 10 - dur + 1):
                    pers = list(range(start, start + dur))
                    if pers[0] <= self.disrupted_dataset.calendar.lunch.after_period < pers[-1]:
                        continue
                    v = model.NewBoolVar(f"rep_b_{b_id}_{day}_{start}")
                    basket_time_vars[(b_id, day, start)] = v

            b_vars = [v for (b, _, _), v in basket_time_vars.items() if b == b_id]
            model.Add(sum(b_vars) == 1)

        # Occupancy tracking
        room_occ: dict[tuple[str, str, int], list[cp_model.IntVar]] = defaultdict(list)
        fac_occ: dict[tuple[str, str, int], list[cp_model.IntVar]] = defaultdict(list)
        grp_occ: dict[tuple[str, str, int], list[cp_model.IntVar]] = defaultdict(list)
        fac_daily: dict[tuple[str, str], list[tuple[int, cp_model.IntVar]]] = defaultdict(list)

        obj_terms: list[tuple[int, cp_model.IntVar]] = []

        for sid, cands in candidates.items():
            session = self.sessions_by_id[sid]
            dur = session.duration
            fac_id = session.faculty_id
            b_id = session.basket_slot

            for idx, cand in enumerate(cands):
                var = model.NewBoolVar(f"rx_{sid}_{idx}")
                x_vars[(sid, idx)] = var

                for p in cand.periods:
                    room_occ[(cand.room_id, cand.day, p)].append(var)
                    fac_occ[(fac_id, cand.day, p)].append(var)

                fac_daily[(fac_id, cand.day)].append((dur, var))

                if not b_id:
                    for g in session.groups:
                        for p in cand.periods:
                            grp_occ[(g, cand.day, p)].append(var)

                # Objective weight: stability penalty + soft costs
                penalty = cand.stability_penalty + cand.cost_s1 + cand.cost_s5 + cand.cost_s6
                obj_terms.append((penalty, var))

        # Basket groups occupancy
        for b_id, b_sessions in baskets.items():
            b_groups = b_sessions[0].groups
            dur = b_sessions[0].duration
            for (b, day, start), b_var in basket_time_vars.items():
                if b == b_id:
                    for p in range(start, start + dur):
                        for g in b_groups:
                            grp_occ[(g, day, p)].append(b_var)

        # H1: Exactly one assignment per session
        for sid, cands in candidates.items():
            session_vars = [x_vars[(sid, idx)] for idx in range(len(cands))]
            model.Add(sum(session_vars) == 1)

        # H11: Basket synchronization
        for b_id, b_sessions in baskets.items():
            for session in b_sessions:
                sid = session.id
                cands = candidates[sid]
                cands_by_time: dict[tuple[str, int], list[cp_model.IntVar]] = defaultdict(list)
                for idx, cand in enumerate(cands):
                    cands_by_time[cand.time_slot_key].append(x_vars[(sid, idx)])

                for (b, day, start), b_var in basket_time_vars.items():
                    if b == b_id:
                        t_vars = cands_by_time.get((day, start), [])
                        model.Add(sum(t_vars) == b_var)

        # H4: Room exclusivity
        for _, vars_list in room_occ.items():
            if len(vars_list) > 1:
                model.Add(sum(vars_list) <= 1)

        # H2: Faculty exclusivity
        for _, vars_list in fac_occ.items():
            if len(vars_list) > 1:
                model.Add(sum(vars_list) <= 1)

        # H3: Student group exclusivity
        for _, vars_list in grp_occ.items():
            if len(vars_list) > 1:
                model.Add(sum(vars_list) <= 1)

        # H12: Faculty daily hours
        for (fac_id, day), items_list in fac_daily.items():
            max_h = next((f.max_hours_per_day for f in self.dataset.faculty if f.id == fac_id), 4)
            model.Add(sum(dur * v for dur, v in items_list) <= max_h)

        # Set Objective: Minimise stability & soft penalties
        model.Minimize(sum(weight * var for weight, var in obj_terms))

        # 4. Solve CP-SAT
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_seconds)
        solver.parameters.num_workers = int(num_workers)

        raw_status = solver.Solve(model)
        solve_dur = time.perf_counter() - start_time

        status_map = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE",
            cp_model.INFEASIBLE: "INFEASIBLE",
            cp_model.UNKNOWN: "UNKNOWN",
            cp_model.MODEL_INVALID: "UNKNOWN",
        }
        status_name = status_map.get(raw_status, "UNKNOWN")

        if raw_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return RepairResult(
                status=status_name,
                is_success=False,
                solve_time_seconds=solve_dur,
                impact_report=impact,
                diagnostics=[f"CP-SAT returned {status_name} for schedule repair."],
            )

        # 5. Extract repaired sessions & calculate changes
        repaired_sessions: list[dict[str, Any]] = []
        session_changes: list[SessionChange] = []

        for sid, cands in candidates.items():
            chosen: RepairPlacement | None = None
            for idx, cand in enumerate(cands):
                if solver.Value(x_vars[(sid, idx)]) == 1:
                    chosen = cand
                    break

            if chosen is not None:
                repaired_sessions.append({
                    "session_id": sid,
                    "day": chosen.day,
                    "start_period": chosen.start_period,
                    "room_id": chosen.room_id,
                })

                orig = self.baseline_timetable.get(sid)
                if orig:
                    orig_day, orig_start, orig_room = orig
                    if (chosen.day, chosen.start_period, chosen.room_id) != (orig_day, orig_start, orig_room):
                        # Classify change type
                        if (chosen.day, chosen.start_period) == (orig_day, orig_start):
                            ch_type = "room_only"
                            reason = f"Room {orig_room} relocated to {chosen.room_id} to resolve outage"
                        else:
                            ch_type = "time_and_room" if chosen.room_id != orig_room else "time_only"
                            reason = f"Rescheduled from {orig_day}-P{orig_start} to {chosen.day}-P{chosen.start_period}"

                        s_obj = self.sessions_by_id[sid]
                        session_changes.append(
                            SessionChange(
                                session_id=sid,
                                course_id=s_obj.course_id,
                                faculty_id=s_obj.faculty_id,
                                groups=s_obj.groups,
                                original_day=orig_day,
                                original_start_period=orig_start,
                                original_room_id=orig_room,
                                proposed_day=chosen.day,
                                proposed_start_period=chosen.start_period,
                                proposed_room_id=chosen.room_id,
                                change_type=ch_type,
                                reason=reason,
                            )
                        )
                else:
                    # Newly introduced session via disruption
                    s_obj = self.sessions_by_id[sid]
                    session_changes.append(
                        SessionChange(
                            session_id=sid,
                            course_id=s_obj.course_id,
                            faculty_id=s_obj.faculty_id,
                            groups=s_obj.groups,
                            original_day="N/A",
                            original_start_period=0,
                            original_room_id="N/A",
                            proposed_day=chosen.day,
                            proposed_start_period=chosen.start_period,
                            proposed_room_id=chosen.room_id,
                            change_type="time_and_room",
                            reason=f"Newly added session scheduled on {chosen.day}-P{chosen.start_period} in {chosen.room_id}",
                        )
                    )

        # 6. Repair Exams if affected
        repaired_exams: list[dict[str, Any]] = list(self.baseline_schedule.get("exams", []))
        exam_changes: list[ExamChange] = []
        affected_exam_ids = {a.activity_id for a in impact.directly_affected_activities if a.activity_type == "exam"}

        if affected_exam_ids:
            # Find alternative exam rooms with sufficient capacity
            for idx, ex in enumerate(repaired_exams):
                if ex.get("exam_id") in affected_exam_ids:
                    orig_rooms = list(ex.get("rooms", []))
                    hit_items = [i for i in self.disruption.get_all_disruption_items() if ex.get("day") in i.affected_days]
                    bad_rooms = {i.resource_id for i in hit_items}
                    
                    new_rooms = []
                    for r in orig_rooms:
                        if r in bad_rooms:
                            # Swap with a compatible alternative room not in bad_rooms and not used in this exam slot
                            used_in_slot = {
                                o_r
                                for other_ex in repaired_exams
                                if other_ex.get("day") == ex.get("day") and other_ex.get("session") == ex.get("session")
                                for o_r in other_ex.get("rooms", [])
                            }
                            compat_rooms = [
                                r_cand.id
                                for r_cand in self.dataset.rooms
                                if "exam" in r_cand.allowed_uses
                                and r_cand.id not in bad_rooms
                                and r_cand.id not in used_in_slot
                                and r_cand.id not in new_rooms
                            ]
                            new_rooms.append(compat_rooms[0] if compat_rooms else r)
                        else:
                            new_rooms.append(r)

                    if new_rooms != orig_rooms:
                        repaired_exams[idx]["rooms"] = new_rooms
                        exam_changes.append(
                            ExamChange(
                                exam_id=ex["exam_id"],
                                course_id=ex.get("course_id", ex["exam_id"]),
                                original_day=ex["day"],
                                original_session=ex["session"],
                                original_rooms=orig_rooms,
                                proposed_day=ex["day"],
                                proposed_session=ex["session"],
                                proposed_rooms=new_rooms,
                                change_type="room_only",
                                reason="Exam venue relocated away from disrupted room",
                            )
                        )

        # 7. Repair Bookings if affected
        fest_week_data = dict(self.baseline_schedule.get("fest_week", {"bookings": [], "session_overrides": []}))
        repaired_bookings = list(fest_week_data.get("bookings", []))
        booking_changes: list[BookingChange] = []
        affected_booking_ids = {a.activity_id for a in impact.directly_affected_activities if a.activity_type == "booking"}

        if affected_booking_ids:
            for idx, b in enumerate(repaired_bookings):
                if b.get("request_id") in affected_booking_ids and b.get("status") == "approved":
                    b_id = b["request_id"]
                    orig_room = b.get("room_id")
                    # Try finding alternative room
                    bad_rooms = {i.resource_id for i in self.disruption.get_all_disruption_items() if b.get("day") in i.affected_days}
                    req_obj = next((r for r in self.dataset.booking_requests if r.id == b_id), None)
                    alt_room = None
                    if req_obj:
                        for r_cand in self.dataset.rooms:
                            if (
                                r_cand.id not in bad_rooms
                                and r_cand.id != orig_room
                                and r_cand.capacity >= req_obj.expected_attendance
                                and (not req_obj.requires_projector or r_cand.features.projector)
                            ):
                                alt_room = r_cand.id
                                break

                    if alt_room:
                        repaired_bookings[idx]["room_id"] = alt_room
                        booking_changes.append(
                            BookingChange(
                                request_id=b_id,
                                event_name=b_id,
                                original_status="approved",
                                original_room_id=orig_room,
                                original_day=b.get("day"),
                                original_start_period=b.get("start_period"),
                                proposed_status="approved",
                                proposed_room_id=alt_room,
                                proposed_day=b.get("day"),
                                proposed_start_period=b.get("start_period"),
                                reason="Relocated event venue away from disrupted room",
                            )
                        )
                    else:
                        repaired_bookings[idx]["status"] = "rejected"
                        repaired_bookings[idx]["reason"] = "Room unavailable and no suitable alternative venue found"
                        booking_changes.append(
                            BookingChange(
                                request_id=b_id,
                                event_name=b_id,
                                original_status="approved",
                                original_room_id=orig_room,
                                proposed_status="rejected",
                                reason="Room unavailable; no alternative room matches capacity",
                            )
                        )

        fest_week_data["bookings"] = repaired_bookings

        # 8. Assemble full repaired schedule
        full_repaired_schedule: dict[str, Any] = {
            "team": self.baseline_schedule.get("team", "OfficialCITTeam"),
            "dataset_id": self.dataset.dataset_id,
            "sessions": repaired_sessions,
            "fest_week": fest_week_data,
            "exams": repaired_exams,
        }

        return RepairResult(
            status=status_name,
            is_success=True,
            solve_time_seconds=solve_dur,
            impact_report=impact,
            repaired_schedule=full_repaired_schedule,
            changed_sessions=session_changes,
            changed_exams=exam_changes,
            changed_bookings=booking_changes,
            unresolved_activities=[],
        )
