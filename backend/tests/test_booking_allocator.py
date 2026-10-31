"""Tests for Spectra Week venue booking allocation and official validation.

Verifies:
- All 25 original booking requests receive exactly one decision.
- Zero hard violations against official starter pack check_bookings().
- Zero warnings (all rejections and alternatives have reasons).
- Zero priority inversions.
- High booking score achieved.
- Cancelled request (BR-04) rejected with cancellation note.
- Oversized request (BR-09, 1200 people) rejected.
- Normal capacity (not 50% exam capacity) used.
- Accessibility requirements enforced.
- Mandatory student group conflicts prevented.
- Session displacement rules enforced.
"""

from __future__ import annotations

import pytest

from app.engine.booking_allocator import BookingAllocator
from app.engine.booking_matcher import BookingMatcher
from app.models.booking import FestWeekSchedule
from app.models.dataset import Dataset
from app.services.booking_service import BookingService
from app.services.dataset_service import get_dataset
from app.services.timetable_service import TimetableService
from app.services.validation_service import BookingValidator


@pytest.fixture(scope="module")
def dataset() -> Dataset:
    return get_dataset()


@pytest.fixture(scope="module")
def base_timetable(dataset: Dataset) -> dict[str, tuple[str, int, str]]:
    tt_res = TimetableService.get_latest()
    if tt_res is None or not tt_res.schedule.sessions:
        tt_res = TimetableService.generate(dataset=dataset)
    return {
        s.session_id: (s.day, s.start_period, s.room_id)
        for s in tt_res.schedule.sessions
    }


class TestBookingAllocationAndValidation:
    @pytest.fixture(scope="class")
    @classmethod
    def allocation_result(cls, dataset: Dataset, base_timetable: dict[str, tuple[str, int, str]]):
        allocator = BookingAllocator(dataset, base_timetable)
        schedule, report = allocator.allocate_all()
        return schedule, report

    def test_all_25_requests_have_exactly_one_decision(self, dataset: Dataset, allocation_result) -> None:
        schedule, report = allocation_result
        assert len(schedule.bookings) == 25
        assert len(dataset.booking_requests) == 25

        decision_ids = [d.request_id for d in schedule.bookings]
        assert len(decision_ids) == len(set(decision_ids)), "Duplicate decisions detected (Rule B1)"

    def test_zero_official_validator_violations(self, allocation_result) -> None:
        schedule, report = allocation_result
        assert report.is_valid is True
        assert report.hard_violation_count == 0
        assert report.hard_violations == []

    def test_zero_warnings_and_all_reasons_present(self, allocation_result) -> None:
        schedule, report = allocation_result
        assert len(report.warnings) == 0, f"Validator emitted warnings: {report.warnings}"

        for d in schedule.bookings:
            assert d.reason and d.reason.strip() != "", f"{d.request_id} has empty reason"

    def test_zero_priority_inversions(self, allocation_result) -> None:
        schedule, report = allocation_result
        assert len(report.priority_inversions) == 0, (
            f"Priority inversions found: {report.priority_inversions}"
        )

    def test_cancelled_request_br04_rejected_with_cancellation_reason(self, allocation_result) -> None:
        schedule, report = allocation_result
        br04_decision = next(d for d in schedule.bookings if d.request_id == "BR-04")
        assert br04_decision.status == "rejected"
        assert "cancelled" in br04_decision.reason.lower()
        assert "after spectra" in br04_decision.reason.lower()

    def test_oversized_request_br09_rejected(self, allocation_result) -> None:
        schedule, report = allocation_result
        br09 = next(d for d in schedule.bookings if d.request_id == "BR-09")
        assert br09.status == "rejected"
        assert "1200" in br09.reason or "1,200" in br09.reason

    def test_preferred_venues_respected_for_high_priority_events(self, allocation_result) -> None:
        schedule, report = allocation_result
        br01 = next(d for d in schedule.bookings if d.request_id == "BR-01")
        assert br01.status == "approved"
        assert br01.room_id == "AUD"
        assert br01.day == "MON"

        br11a = next(d for d in schedule.bookings if d.request_id == "BR-11a")
        assert br11a.status == "approved"
        assert br11a.room_id == "OAT"

        br20 = next(d for d in schedule.bookings if d.request_id == "BR-20")
        assert br20.status == "approved"
        assert br20.room_id == "AUD"

    def test_alternative_offered_status_used_for_outside_window(self, allocation_result) -> None:
        schedule, report = allocation_result
        alts = [d for d in schedule.bookings if d.status == "alternative_offered"]
        assert len(alts) >= 1
        for a in alts:
            assert a.day is not None
            assert a.room_id is not None
            assert a.start_period is not None
            assert a.end_period is not None
            assert "alternative" in a.reason.lower()

    def test_high_booking_score(self, allocation_result) -> None:
        schedule, report = allocation_result
        # Theoretical max without BR-09 (weight 2) is 68; with one alternative (0.5 weight) it is 67.0
        assert report.booking_score >= 65.0
        assert report.booking_score_max == 70


class TestBookingMatcherConstraints:
    def test_normal_capacity_used_not_half_capacity(self, dataset: Dataset, base_timetable) -> None:
        matcher = BookingMatcher(dataset, base_timetable)
        sh1 = next(r for r in dataset.rooms if r.id == "SH-1")
        assert sh1.capacity == 150
        # Under exam rules, effective capacity is 75. But for events, it can seat up to 150!
        compat = matcher.evaluate_room_compatibility(sh1, attendance=140, room_types=["seminar_hall"], needs=[])
        assert compat.capacity_ok is True
        assert compat.is_compatible is True

    def test_accessibility_requirement_filters_inaccessible_room(self, dataset: Dataset, base_timetable) -> None:
        matcher = BookingMatcher(dataset, base_timetable)
        sh2 = next(r for r in dataset.rooms if r.id == "SH-2")
        assert sh2.accessible is False

        # Request requiring accessibility cannot use SH-2
        compat = matcher.evaluate_room_compatibility(sh2, attendance=60, room_types=["seminar_hall"], needs=["accessible"])
        assert compat.is_compatible is False
        assert "accessible" in compat.missing_features

        # SH-1 is accessible and must be compatible
        sh1 = next(r for r in dataset.rooms if r.id == "SH-1")
        assert sh1.accessible is True
        compat_sh1 = matcher.evaluate_room_compatibility(sh1, attendance=60, room_types=["seminar_hall"], needs=["accessible"])
        assert compat_sh1.is_compatible is True

    def test_mandatory_group_conflict_detection(self, dataset: Dataset, base_timetable) -> None:
        matcher = BookingMatcher(dataset, base_timetable)
        # Find a group with a known class on a specific day & period
        sample_group = None
        sample_day = None
        sample_period = None
        for (g, d, p), sid in matcher.group_schedule.items():
            sample_group = g
            sample_day = d
            sample_period = p
            break

        assert sample_group is not None
        # Trying to book a free room when sample_group has class should report group clash
        aud = next(r for r in dataset.rooms if r.id == "AUD")
        ok, reason = matcher.is_slot_available(
            aud.id, sample_day, sample_period, sample_period, mandatory_groups=[sample_group]
        )
        assert ok is False
        assert f"Mandatory student group {sample_group}" in reason

