"""Timetable API router exposing generate, fetch, and validate endpoints.

Mounted under /api/v1/timetable.
"""

from __future__ import annotations

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status

from app.models.timetable import (
    GenerateTimetableRequest,
    TimetableResponse,
    TimetableValidationResponse,
)
from app.models.user import UserResponse, UserRole
from app.routers.auth import get_current_user_optional
from app.services.timetable_service import TimetableService

router = APIRouter(prefix="/timetable", tags=["timetable"])


@router.post(
    "/generate",
    response_model=TimetableResponse,
    summary="Generate a complete timetable using Google OR-Tools CP-SAT",
)
def generate_timetable(
    request: GenerateTimetableRequest | None = None,
    current_user: Annotated[UserResponse | None, Depends(get_current_user_optional)] = None,
) -> TimetableResponse:
    """Run the CP-SAT engine to schedule all 189 teaching sessions without hard clashes.

    Persists the result to exports/timetable_draft.json and caches it in memory.
    Restricted to Campus Administrators and Department Coordinators.
    """
    if current_user and current_user.role not in (UserRole.ADMIN, UserRole.DEPARTMENT_COORDINATOR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Timetable generation requires administrative or departmental coordinator privileges.",
        )

    req = request or GenerateTimetableRequest()
    response = TimetableService.generate(req)

    if not response.metadata.solver_status in ("OPTIMAL", "FEASIBLE"):
        raise HTTPException(
            status_code=422,
            detail={
                "message": f"CP-SAT solver returned {response.metadata.solver_status}",
                "metadata": response.metadata.model_dump(),
                "violations": response.violations,
            },
        )

    return response


@router.get(
    "",
    response_model=TimetableResponse,
    summary="Get the most recently generated timetable",
)
def get_latest_timetable(
    faculty_id: str | None = None,
    current_user: Annotated[UserResponse | None, Depends(get_current_user_optional)] = None,
) -> TimetableResponse:
    """Retrieve the latest generated timetable.

    Supports optional filtering by faculty_id or authenticated faculty role.
    Returns 404 if no timetable has been generated yet.
    """
    timetable = TimetableService.get_latest()
    if timetable is None:
        raise HTTPException(
            status_code=404,
            detail="No timetable generated yet. Call POST /api/v1/timetable/generate first.",
        )

    active_faculty_id = faculty_id
    if not active_faculty_id and current_user and current_user.role == UserRole.FACULTY:
        active_faculty_id = current_user.faculty_id or "F01"

    if active_faculty_id:
        target_fid = active_faculty_id.strip().upper()
        filtered_sessions = [
            s for s in timetable.schedule.sessions
            if s.faculty_id and s.faculty_id.upper() == target_fid
        ]
        filtered_schedule = timetable.schedule.model_copy(
            update={"sessions": filtered_sessions}
        )
        return TimetableResponse(
            schedule=filtered_schedule,
            metadata=timetable.metadata,
            violations=timetable.violations,
        )

    return timetable


@router.get(
    "/faculty/{faculty_id}",
    response_model=TimetableResponse,
    summary="Get timetable sessions assigned to a specific faculty member",
)
def get_faculty_timetable(faculty_id: str) -> TimetableResponse:
    """Retrieve timetable sessions filtered for a specific faculty member."""
    timetable = TimetableService.get_latest()
    if timetable is None:
        raise HTTPException(
            status_code=404,
            detail="No timetable generated yet. Call POST /api/v1/timetable/generate first.",
        )

    target_fid = faculty_id.strip().upper()
    filtered_sessions = [
        s for s in timetable.schedule.sessions
        if s.faculty_id and s.faculty_id.upper() == target_fid
    ]
    filtered_schedule = timetable.schedule.model_copy(
        update={"sessions": filtered_sessions}
    )
    return TimetableResponse(
        schedule=filtered_schedule,
        metadata=timetable.metadata,
        violations=timetable.violations,
    )


@router.get(
    "/validation",
    response_model=TimetableValidationResponse,
    summary="Validate the latest timetable using the official validator",
)
def get_timetable_validation() -> TimetableValidationResponse:
    """Evaluate the current timetable against official validator.py rules."""
    validation = TimetableService.get_validation()
    if validation is None:
        raise HTTPException(
            status_code=404,
            detail="No timetable generated yet. Call POST /api/v1/timetable/generate first.",
        )
    return validation

