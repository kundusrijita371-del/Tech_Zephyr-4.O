"""Priority engine for Spectra Week venue booking requests.

Implements the official dataset-driven priority system matching validator.py:
- Priority order: exam -> regular_session -> institute_event -> guest_lecture -> department_event -> club_event.
- Role caps:
    admin -> institute_event
    faculty -> guest_lecture
    department_coordinator -> department_event
    club -> club_event
- Earlier submitted_at breaks ties among requests with equal effective priority.
"""

from __future__ import annotations

import functools
from typing import Any, Mapping

from app.models.dataset import BookingRequest, Dataset

CAT_WEIGHT: dict[str, int] = {
    "institute_event": 5,
    "guest_lecture": 4,
    "department_event": 3,
    "club_event": 2,
}


def get_effective_category(dataset: Dataset | dict[str, Any], req: BookingRequest | dict[str, Any]) -> str:
    """Calculate the effective category for a booking request after applying role caps.

    Exactly replicates validator.py:
      order = data["priority_order"]
      cap = data["role_category_cap"].get(req["role"], "club_event")
      a = order.index(req["requested_category"]) if req["requested_category"] in order else len(order) - 1
      return order[max(a, order.index(cap))]
    """
    if isinstance(dataset, Dataset):
        order = dataset.priority_order
        role_caps = dataset.role_category_cap
    else:
        order = dataset["priority_order"]
        role_caps = dataset["role_category_cap"]

    if isinstance(req, BookingRequest):
        req_role = req.role
        req_category = req.requested_category
    else:
        req_role = req.get("role", "club")
        req_category = req.get("requested_category", "club_event")

    cap = role_caps.get(req_role, "club_event")
    a = order.index(req_category) if req_category in order else len(order) - 1
    cap_idx = order.index(cap) if cap in order else len(order) - 1

    # In priority_order, lower index means higher priority.
    # max(a, cap_idx) ensures a requester cannot elevate beyond their role cap index.
    return order[max(a, cap_idx)]


def request_outranks(
    dataset: Dataset | dict[str, Any],
    r1: BookingRequest | dict[str, Any],
    r2: BookingRequest | dict[str, Any],
) -> bool:
    """Return True if request r1 has strict priority over request r2.

    Higher effective priority wins; if equal, earlier submitted_at wins.
    Matches validator.outranks exactly.
    """
    if isinstance(dataset, Dataset):
        order = dataset.priority_order
    else:
        order = dataset["priority_order"]

    eff1 = get_effective_category(dataset, r1)
    eff2 = get_effective_category(dataset, r2)

    c1 = order.index(eff1)
    c2 = order.index(eff2)

    if c1 != c2:
        return c1 < c2

    sub1 = r1.submitted_at if isinstance(r1, BookingRequest) else r1.get("submitted_at", "")
    sub2 = r2.submitted_at if isinstance(r2, BookingRequest) else r2.get("submitted_at", "")

    return sub1 < sub2


def compare_requests(
    dataset: Dataset | dict[str, Any],
    r1: BookingRequest | dict[str, Any],
    r2: BookingRequest | dict[str, Any],
) -> int:
    """Three-way comparator for sort keys: returns -1 if r1 outranks r2, 1 if r2 outranks r1, else 0."""
    if request_outranks(dataset, r1, r2):
        return -1
    elif request_outranks(dataset, r2, r1):
        return 1
    return 0


def sort_requests_by_priority(
    dataset: Dataset | dict[str, Any],
    requests: list[Any],
) -> list[Any]:
    """Sort a list of booking requests in descending priority order."""
    comparator = functools.partial(compare_requests, dataset)
    return sorted(requests, key=functools.cmp_to_key(comparator))

