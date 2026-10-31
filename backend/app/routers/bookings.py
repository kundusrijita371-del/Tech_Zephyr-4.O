"""FastAPI router for Spectra Week venue booking engine.

Mounted under /api/v1/bookings.
"""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException

from app.models.booking import (
    BookingRequestItem,
    BookingValidationReport,
    EvaluateBookingRequest,
    EvaluateBookingResponse,
    FestWeekSchedule,
    ManualDecisionRequest,
)
from app.services.booking_service import BookingService

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get(
    "",
    response_model=list[BookingRequestItem],
    summary="Get all 25 Spectra Week booking requests and current decisions",
)
def get_all_bookings() -> list[BookingRequestItem]:
    """Retrieve all 25 original booking requests combined with their allocated decisions."""
    return BookingService.get_all_requests_with_decisions()


@router.post(
    "/generate",
    response_model=BookingValidationReport,
    summary="Run deterministic priority-aware booking allocation for all requests",
)
def generate_bookings() -> BookingValidationReport:
    """Allocate campus venues for all 25 Spectra Week requests in strict priority order.

    Applies role category caps, timestamp tie-breaking, requested room preferences,
    room capacity & accessibility, timetable & booking clash checks, and session displacement.
    """
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
) -> BookingValidationReport:
    """Record a decision for a booking request, verifying all constraints with validator.py."""
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

