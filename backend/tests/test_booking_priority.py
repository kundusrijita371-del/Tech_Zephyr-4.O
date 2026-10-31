"""Unit tests for the Spectra Week booking priority engine.

Verifies:
- All role category caps:
    admin -> institute_event
    faculty -> guest_lecture
    department_coordinator -> department_event
    club -> club_event
- Requester cannot elevate priority beyond their role cap.
- Requester can request a lower-priority category than their cap.
- Priority ordering:
    exam > regular_session > institute_event > guest_lecture > department_event > club_event
- Submission timestamp tie-breaking.
"""

from __future__ import annotations

import pytest

from app.engine.booking_priority import (
    get_effective_category,
    request_outranks,
    sort_requests_by_priority,
)
from app.models.dataset import Dataset
from app.services.dataset_service import get_dataset


@pytest.fixture(scope="module")
def dataset() -> Dataset:
    return get_dataset()


class TestRoleCategoryCaps:
    def test_admin_role_cap(self, dataset: Dataset) -> None:
        # Admin can claim institute_event
        req = {"role": "admin", "requested_category": "institute_event"}
        assert get_effective_category(dataset, req) == "institute_event"

        # Admin requesting lower category stays at lower category
        req_lower = {"role": "admin", "requested_category": "guest_lecture"}
        assert get_effective_category(dataset, req_lower) == "guest_lecture"

    def test_faculty_role_cap(self, dataset: Dataset) -> None:
        # Faculty capped at guest_lecture
        req_over = {"role": "faculty", "requested_category": "institute_event"}
        assert get_effective_category(dataset, req_over) == "guest_lecture"

        req_legit = {"role": "faculty", "requested_category": "guest_lecture"}
        assert get_effective_category(dataset, req_legit) == "guest_lecture"

        req_lower = {"role": "faculty", "requested_category": "club_event"}
        assert get_effective_category(dataset, req_lower) == "club_event"

    def test_department_coordinator_role_cap(self, dataset: Dataset) -> None:
        # Department coordinator capped at department_event
        req_over_inst = {"role": "department_coordinator", "requested_category": "institute_event"}
        assert get_effective_category(dataset, req_over_inst) == "department_event"

        req_over_guest = {"role": "department_coordinator", "requested_category": "guest_lecture"}
        assert get_effective_category(dataset, req_over_guest) == "department_event"

        req_legit = {"role": "department_coordinator", "requested_category": "department_event"}
        assert get_effective_category(dataset, req_legit) == "department_event"

    def test_club_role_cap(self, dataset: Dataset) -> None:
        # Club capped at club_event regardless of requested category
        for cat in ("institute_event", "guest_lecture", "department_event", "club_event"):
            req = {"role": "club", "requested_category": cat}
            assert get_effective_category(dataset, req) == "club_event", (
                f"Club requested '{cat}' but should be capped at 'club_event'"
            )

    def test_unknown_role_defaults_to_club_cap(self, dataset: Dataset) -> None:
        req = {"role": "outsider", "requested_category": "institute_event"}
        assert get_effective_category(dataset, req) == "club_event"

    def test_dataset_br15_club_claiming_institute_event_is_capped(self, dataset: Dataset) -> None:
        # In cit_public.json, BR-15 (Spectra Jam Night) is requested by club as institute_event
        br15 = next(r for r in dataset.booking_requests if r.id == "BR-15")
        assert br15.role == "club"
        assert br15.requested_category == "institute_event"
        assert get_effective_category(dataset, br15) == "club_event"


class TestPriorityOrderingAndTieBreaking:
    def test_higher_priority_outranks_lower_priority(self, dataset: Dataset) -> None:
        # institute_event (admin) outranks guest_lecture (faculty) even if submitted later
        r1 = {"role": "admin", "requested_category": "institute_event", "submitted_at": "2027-02-01T12:00:00"}
        r2 = {"role": "faculty", "requested_category": "guest_lecture", "submitted_at": "2027-01-01T08:00:00"}

        assert request_outranks(dataset, r1, r2) is True
        assert request_outranks(dataset, r2, r1) is False

    def test_timestamp_tie_breaking_for_equal_priority(self, dataset: Dataset) -> None:
        # Two club events: earlier submission wins
        r_early = {"role": "club", "requested_category": "club_event", "submitted_at": "2027-01-20T10:00:00"}
        r_late = {"role": "club", "requested_category": "club_event", "submitted_at": "2027-01-20T10:05:00"}

        assert request_outranks(dataset, r_early, r_late) is True
        assert request_outranks(dataset, r_late, r_early) is False

    def test_sorting_preserves_strict_priority_hierarchy(self, dataset: Dataset) -> None:
        reqs = [
            {"id": "R_club", "role": "club", "requested_category": "club_event", "submitted_at": "2027-01-01T10:00:00"},
            {"id": "R_dept", "role": "department_coordinator", "requested_category": "department_event", "submitted_at": "2027-01-02T10:00:00"},
            {"id": "R_inst", "role": "admin", "requested_category": "institute_event", "submitted_at": "2027-01-03T10:00:00"},
            {"id": "R_guest", "role": "faculty", "requested_category": "guest_lecture", "submitted_at": "2027-01-04T10:00:00"},
        ]

        sorted_reqs = sort_requests_by_priority(dataset, reqs)
        order_ids = [r["id"] for r in sorted_reqs]
        assert order_ids == ["R_inst", "R_guest", "R_dept", "R_club"]

