"""Booking service coordinating venue allocation, memory state, export, and official validation."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.config import (
    BOOKINGS_DRAFT_PATH,
    EXPORTS_DIR,
    SCHEDULE_DRAFT_PATH,
    SCHEDULE_FINAL_PATH,
    TIMETABLE_DRAFT_PATH,
)
from app.engine.booking_allocator import BookingAllocator
from app.engine.booking_matcher import BookingMatcher
from app.engine.booking_priority import get_effective_category
from app.models.booking import (
    BookingDecision,
    BookingRequestItem,
    BookingValidationReport,
    EvaluateBookingRequest,
    EvaluateBookingResponse,
    FestWeekSchedule,
    ManualDecisionRequest,
    SlotOption,
)
from app.models.dataset import Dataset
from app.services.dataset_service import get_dataset
from app.services.timetable_service import TimetableService
from app.services.validation_service import BookingValidator

logger = logging.getLogger(__name__)


class BookingService:
    """Singleton service managing Spectra Week venue bookings and schedule integration."""

    _latest_schedule: FestWeekSchedule | None = None
    _latest_report: BookingValidationReport | None = None

    @classmethod
    def _get_base_timetable(cls, ds: Dataset) -> dict[str, tuple[str, int, str]]:
        """Retrieve base timetable assignment mapping session_id -> (day, start_period, room_id)."""
        tt_res = TimetableService.get_latest()
        if tt_res is None or not tt_res.schedule.sessions:
            logger.info("Generating base timetable for booking allocation...")
            tt_res = TimetableService.generate(dataset=ds)

        return {
            s.session_id: (s.day, s.start_period, s.room_id)
            for s in tt_res.schedule.sessions
        }

    @classmethod
    def generate(
        cls,
        dataset: Dataset | None = None,
    ) -> tuple[FestWeekSchedule, BookingValidationReport]:
        """Run deterministic priority-aware booking allocation for all 25 requests."""
        ds = dataset or get_dataset()
        try:
            from app.services.settings_service import SettingsService
            saved_order = SettingsService.get_booking_priority()
            if saved_order:
                ds.priority_order = list(saved_order)
        except Exception:
            pass

        base_timetable = cls._get_base_timetable(ds)

        allocator = BookingAllocator(ds, base_timetable)
        schedule, report = allocator.allocate_all()

        cls._latest_schedule = schedule
        cls._latest_report = report

        cls._export_schedule(schedule, base_timetable=base_timetable)
        return schedule, report

    @classmethod
    def get_latest(cls) -> tuple[FestWeekSchedule, BookingValidationReport] | None:
        """Retrieve the most recently generated booking schedule and validation report."""
        if cls._latest_schedule is not None and cls._latest_report is not None:
            return cls._latest_schedule, cls._latest_report

        # Try recovering from disk
        if BOOKINGS_DRAFT_PATH.exists():
            try:
                raw = json.loads(BOOKINGS_DRAFT_PATH.read_text(encoding="utf-8"))
                schedule = FestWeekSchedule.model_validate(raw)
                ds = get_dataset()
                base = cls._get_base_timetable(ds)
                report = BookingValidator.validate_fest_week(ds, base, schedule)
                cls._latest_schedule = schedule
                cls._latest_report = report
                return schedule, report
            except Exception as exc:
                logger.warning("Could not restore bookings from %s: %s", BOOKINGS_DRAFT_PATH, exc)

        return None

    @classmethod
    def get_all_requests_with_decisions(
        cls, dataset: Dataset | None = None
    ) -> list[BookingRequestItem]:
        """Return all 25 original booking requests combined with their current decisions."""
        ds = dataset or get_dataset()
        latest = cls.get_latest()
        if latest is None:
            # Auto-generate if not yet generated
            latest = cls.generate(ds)

        schedule, _ = latest
        decisions_map: dict[str, BookingDecision] = {
            d.request_id: d for d in schedule.bookings
        }
        canc_map = {c.request_id: c.note for c in ds.cancellations}

        items: list[BookingRequestItem] = []
        for req in ds.booking_requests:
            is_canc = req.id in canc_map
            eff_cat = get_effective_category(ds, req)

            # Department can be derived from requester or role
            dept = req.role if req.role in ("admin", "faculty", "department_coordinator") else "Student Activities"

            items.append(
                BookingRequestItem(
                    id=req.id,
                    submitted_at=req.submitted_at,
                    requester=req.requester,
                    role=req.role,
                    department=dept,
                    requested_category=req.requested_category,
                    effective_category=eff_cat,
                    title=req.title,
                    attendance=req.attendance,
                    duration_periods=req.duration_periods,
                    windows=[
                        {"day": w.day, "from_period": w.from_period, "to_period": w.to_period}  # type: ignore
                        for w in req.windows
                    ],
                    room_types=req.room_types,
                    needs=req.needs,
                    requested_room=req.requested_room,
                    mandatory_for_groups=req.mandatory_for_groups,
                    series_id=req.series_id,
                    raw_text=req.raw_text,
                    is_cancelled=is_canc,
                    cancellation_note=canc_map.get(req.id),
                    decision=decisions_map.get(req.id),
                )
            )

        return items

    @classmethod
    def get_single_request(
        cls, request_id: str, dataset: Dataset | None = None
    ) -> BookingRequestItem | None:
        """Retrieve single request with its current decision and explanation."""
        all_reqs = cls.get_all_requests_with_decisions(dataset)
        return next((r for r in all_reqs if r.id == request_id), None)

    @classmethod
    def evaluate_request(
        cls, eval_req: EvaluateBookingRequest, dataset: Dataset | None = None
    ) -> EvaluateBookingResponse:
        """Evaluate an editable booking request without persisting decisions."""
        ds = dataset or get_dataset()
        base_timetable = cls._get_base_timetable(ds)
        matcher = BookingMatcher(ds, base_timetable)

        req_dict = eval_req.model_dump()
        eff_cat = get_effective_category(ds, req_dict)
        role_cap = ds.role_category_cap.get(eval_req.role, "club_event")

        # Find compatible rooms
        compatible_rooms = matcher.get_compatible_rooms(
            attendance=eval_req.attendance,
            room_types=eval_req.room_types,
            needs=eval_req.needs,
            preferred_room_id=eval_req.requested_room,
        )

        compatible_room_ids = [r.id for r in compatible_rooms]

        # Check slots inside windows
        available_slots: list[SlotOption] = []
        conflicts: list[str] = []

        for w in eval_req.windows:
            for s0 in range(w.from_period, w.to_period - eval_req.duration_periods + 2):
                end_p = s0 + eval_req.duration_periods - 1
                if end_p > matcher.MAX_PERIOD:
                    conflicts.append(f"Window {w.day} P{s0}-P{end_p} exceeds maximum period {matcher.MAX_PERIOD}")
                    continue

                for room in compatible_rooms:
                    ok, conflict_reason = matcher.is_slot_available(
                        room.id, w.day, s0, end_p, eval_req.mandatory_for_groups
                    )
                    if ok:
                        available_slots.append(
                            SlotOption(
                                day=w.day,
                                start_period=s0,
                                end_period=end_p,
                                room_id=room.id,
                                is_inside_window=True,
                                is_requested_room=(room.id == eval_req.requested_room),
                            )
                        )
                    elif conflict_reason:
                        conflicts.append(f"{room.id} on {w.day} P{s0}-P{end_p}: {conflict_reason}")

        # Alternative slot
        alt_option: SlotOption | None = None
        if not available_slots:
            alt_found = matcher.find_alternative_slot(
                duration_periods=eval_req.duration_periods,
                compatible_rooms=compatible_rooms,
                mandatory_groups=eval_req.mandatory_for_groups,
                preferred_room_id=eval_req.requested_room,
            )
            if alt_found:
                alt_room, alt_day, alt_a, alt_b = alt_found
                alt_option = SlotOption(
                    day=alt_day,
                    start_period=alt_a,
                    end_period=alt_b,
                    room_id=alt_room.id,
                    is_inside_window=False,
                    is_requested_room=(alt_room.id == eval_req.requested_room),
                )

        # Recommendation
        if available_slots:
            best = available_slots[0]
            recommendation = BookingDecision(
                request_id=eval_req.request_id or "EVAL",
                status="approved",
                day=best.day,
                start_period=best.start_period,
                end_period=best.end_period,
                room_id=best.room_id,
                reason=f"Approved in {best.room_id} on {best.day} P{best.start_period}-P{best.end_period}",
            )
        elif alt_option:
            recommendation = BookingDecision(
                request_id=eval_req.request_id or "EVAL",
                status="alternative_offered",
                day=alt_option.day,
                start_period=alt_option.start_period,
                end_period=alt_option.end_period,
                room_id=alt_option.room_id,
                reason=f"Original window unavailable; alternative offered in {alt_option.room_id} on {alt_option.day} P{alt_option.start_period}-P{alt_option.end_period}",
            )
        else:
            recommendation = BookingDecision(
                request_id=eval_req.request_id or "EVAL",
                status="rejected",
                reason="No compatible room available without clash during or outside requested windows",
            )

        return EvaluateBookingResponse(
            effective_category=eff_cat,
            role_cap=role_cap,
            is_feasible=(len(available_slots) > 0 or alt_option is not None),
            compatible_rooms=compatible_room_ids,
            available_slots_inside_windows=available_slots,
            suggested_alternative=alt_option,
            conflicts=conflicts[:10],
            recommendation=recommendation,
        )

    @classmethod
    def record_manual_decision(
        cls,
        request_id: str,
        manual: ManualDecisionRequest,
        dataset: Dataset | None = None,
    ) -> BookingValidationReport:
        """Record or override a decision for a booking request and re-validate."""
        ds = dataset or get_dataset()
        latest = cls.get_latest()
        if latest is None:
            cls.generate(ds)
            latest = cls.get_latest()

        assert latest is not None
        schedule, _ = latest

        # Check cancellations constraint (Rule B3)
        if request_id in [c.request_id for c in ds.cancellations] and manual.status in ("approved", "alternative_offered"):
            raise ValueError(f"Request {request_id} was cancelled and cannot be approved or offered as an alternative (Rule B3).")

        new_decision = BookingDecision(
            request_id=request_id,
            status=manual.status,
            day=manual.day,
            start_period=manual.start_period,
            end_period=manual.end_period,
            room_id=manual.room_id,
            reason=manual.reason,
        )

        # Update decisions
        updated_decisions = [
            new_decision if d.request_id == request_id else d
            for d in schedule.bookings
        ]
        if not any(d.request_id == request_id for d in updated_decisions):
            updated_decisions.append(new_decision)

        updated_schedule = FestWeekSchedule(
            bookings=updated_decisions,
            session_overrides=schedule.session_overrides,
        )

        base = cls._get_base_timetable(ds)
        report = BookingValidator.validate_fest_week(ds, base, updated_schedule)

        cls._latest_schedule = updated_schedule
        cls._latest_report = report
        cls._export_schedule(updated_schedule)
        return report

    @classmethod
    def clear_state(cls) -> None:
        """Reset internal state (used primarily in tests)."""
        cls._latest_schedule = None
        cls._latest_report = None

    @classmethod
    def _export_schedule(
        cls,
        fest_week: FestWeekSchedule,
        base_timetable: dict[str, tuple[str, int, str]] | None = None,
    ) -> None:
        """Persist bookings to bookings_draft.json and merge into schedule_draft.json and schedule.json."""
        try:
            EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

            # 1. Write dedicated bookings_draft.json
            BOOKINGS_DRAFT_PATH.write_text(
                json.dumps(fest_week.model_dump(), indent=2), encoding="utf-8"
            )

            # 2. Merge into schedule_draft.json & schedule.json
            combined: dict[str, Any] = {
                "team": "HackerX",
                "dataset_id": "cit-public-v1",
                "sessions": [],
                "fest_week": fest_week.model_dump(),
                "exams": [],
            }

            if SCHEDULE_FINAL_PATH.exists():
                try:
                    existing = json.loads(SCHEDULE_FINAL_PATH.read_text(encoding="utf-8"))
                    if isinstance(existing, dict) and len(existing.get("sessions", [])) == 189:
                        combined["team"] = existing.get("team", "HackerX")
                        combined["dataset_id"] = existing.get("dataset_id", "cit-public-v1")
                        combined["sessions"] = existing.get("sessions", [])
                        combined["exams"] = existing.get("exams", [])
                except Exception:
                    pass

            if not combined.get("sessions") and SCHEDULE_DRAFT_PATH.exists():
                try:
                    draft = json.loads(SCHEDULE_DRAFT_PATH.read_text(encoding="utf-8"))
                    if isinstance(draft, dict) and len(draft.get("sessions", [])) == 189:
                        combined["sessions"] = draft.get("sessions", [])
                        if not combined.get("exams"):
                            combined["exams"] = draft.get("exams", [])
                except Exception:
                    pass

            if not combined.get("sessions") and TIMETABLE_DRAFT_PATH.exists():
                try:
                    tt_raw = json.loads(TIMETABLE_DRAFT_PATH.read_text(encoding="utf-8"))
                    if isinstance(tt_raw, dict) and len(tt_raw.get("sessions", [])) == 189:
                        combined["sessions"] = tt_raw.get("sessions", [])
                except Exception:
                    pass

            if not combined.get("sessions") and base_timetable and len(base_timetable) == 189:
                combined["sessions"] = [
                    {"session_id": sid, "day": day, "start_period": p, "room_id": r}
                    for sid, (day, p, r) in base_timetable.items()
                ]

            if not combined.get("sessions"):
                tt_latest = TimetableService.get_latest()
                if tt_latest and tt_latest.schedule.sessions and len(tt_latest.schedule.sessions) == 189:
                    combined["sessions"] = [s.model_dump() for s in tt_latest.schedule.sessions]
                else:
                    tt_gen = TimetableService.generate(dataset=get_dataset())
                    combined["sessions"] = [s.model_dump() for s in tt_gen.schedule.sessions]

            SCHEDULE_DRAFT_PATH.write_text(
                json.dumps(combined, indent=2), encoding="utf-8"
            )
            # Also write to exports/schedule.json as required by official format
            SCHEDULE_FINAL_PATH.write_text(
                json.dumps(combined, indent=2), encoding="utf-8"
            )
            logger.info("Exported fest_week schedule to %s and %s", SCHEDULE_DRAFT_PATH, SCHEDULE_FINAL_PATH)
        except Exception as exc:
            logger.error("Failed to export fest_week schedule: %s", exc)

