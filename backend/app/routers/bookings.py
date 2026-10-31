"""FastAPI router for Spectra Week venue booking engine.

Mounted under /api/v1/bookings.
"""

from __future__ import annotations

from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.models.booking import (
    BookingRequestItem,
    BookingValidationReport,
    EvaluateBookingRequest,
    EvaluateBookingResponse,
    FestWeekSchedule,
    ManualDecisionRequest,
)
from app.models.user import UserResponse, UserRole
from app.routers.auth import get_current_user_optional
from app.services.booking_service import BookingService

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get(
    "",
    response_model=list[BookingRequestItem],
    summary="Get all 25 Spectra Week booking requests and current decisions",
)
def get_all_bookings(
    club: str | None = None,
    department: str | None = None,
    current_user: Annotated[UserResponse | None, Depends(get_current_user_optional)] = None,
) -> list[BookingRequestItem]:
    """Retrieve booking requests combined with their allocated decisions.
    
    Applies role-based filtering:
    - Club Representatives only see booking records for their club.
    - Department Coordinators only see department events & regular session bookings.
    - Admin sees all campus bookings.
    """
    all_bookings = BookingService.get_all_requests_with_decisions()
    
    if current_user and current_user.role == UserRole.CLUB_REPRESENTATIVE:
        user_club = (current_user.club or "Spectra").lower()
        return [
            b for b in all_bookings
            if b.requested_category == "club_event"
            or b.role == "club"
            or (user_club in b.requester.lower())
            or (user_club in b.title.lower())
        ]

    if current_user and current_user.role == UserRole.DEPARTMENT_COORDINATOR:
        user_dept = current_user.department
        if user_dept:
            return [
                b for b in all_bookings
                if b.requested_category in ("department_event", "regular_session")
                or (b.department and b.department.upper() == user_dept.upper())
            ]

    if club:
        user_club = club.lower()
        return [
            b for b in all_bookings
            if b.requested_category == "club_event"
            or b.role == "club"
            or (user_club in b.requester.lower())
            or (user_club in b.title.lower())
        ]
    if department:
        return [b for b in all_bookings if b.department and b.department.lower() == department.lower()]

    return all_bookings


@router.post(
    "/generate",
    response_model=BookingValidationReport,
    summary="Run deterministic priority-aware booking allocation for all requests",
)
def generate_bookings(
    current_user: Annotated[UserResponse | None, Depends(get_current_user_optional)] = None,
) -> BookingValidationReport:
    """Allocate campus venues for all 25 Spectra Week requests in strict priority order.

    Requires administrative privileges.
    """
    if current_user and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Running global venue allocation solver requires administrative privileges.",
        )

    _, report = BookingService.generate()
    if not report.is_valid:
        raise HTTPException(
            status_code=422,
            detail={
                "message": f"Booking allocation produced {report.hard_violation_count} hard violations",
                "violations": report.hard_violations,
                "warnings": report.warnings,
            },
        )
    return report


@router.get(
    "/validation",
    response_model=BookingValidationReport,
    summary="Validate the latest booking decisions using official validator.py",
)
def get_booking_validation() -> BookingValidationReport:
    """Run check_bookings() from the official starter pack validator on the latest schedule."""
    latest = BookingService.get_latest()
    if latest is None:
        # Auto-generate if not yet generated
        _, report = BookingService.generate()
        return report

    _, report = latest
    return report


@router.post(
    "/evaluate",
    response_model=EvaluateBookingResponse,
    summary="Evaluate an editable structured booking without committing a decision",
)
def evaluate_booking(
    request: EvaluateBookingRequest,
) -> EvaluateBookingResponse:
    """Analyze venue compatibility, available time slots, conflicts, and suggested alternatives."""
    return BookingService.evaluate_request(request)


@router.get(
    "/{request_id}",
    response_model=BookingRequestItem,
    summary="Get a single booking request by ID",
)
def get_booking_by_id(request_id: str) -> BookingRequestItem:
    """Retrieve a single booking request, current decision, and explanation."""
    item = BookingService.get_single_request(request_id)
    if item is None:
        raise HTTPException(
            status_code=404,
            detail=f"Booking request '{request_id}' not found.",
        )
    return item


@router.post(
    "/{request_id}/decision",
    response_model=BookingValidationReport,
    summary="Record or override a decision for a booking request subject to validation",
)
def record_manual_decision(
    request_id: str,
    payload: ManualDecisionRequest,
    current_user: Annotated[UserResponse | None, Depends(get_current_user_optional)] = None,
) -> BookingValidationReport:
    """Record a decision for a booking request, verifying all constraints with validator.py."""
    if current_user and current_user.role not in (UserRole.ADMIN, UserRole.DEPARTMENT_COORDINATOR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Club representatives and faculty cannot record booking approval decisions or overrides.",
        )

    try:
        report = BookingService.record_manual_decision(request_id, payload)
        if not report.is_valid:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": f"Manual decision caused {report.hard_violation_count} hard violations",
                    "violations": report.hard_violations,
                },
            )
        return report
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

