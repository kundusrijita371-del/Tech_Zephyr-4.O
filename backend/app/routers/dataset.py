"""Dataset router — API endpoints exposing validated CIT dataset entities.

Mounted under /api/v1/dataset by the FastAPI application.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.dataset import (
    BookingRequest,
    Calendar,
    Course,
    DatasetMeta,
    DatasetSummary,
    Exam,
    Faculty,
    Room,
    Session,
    StudentGroup,
)
from app.services.dataset_service import get_dataset, get_dataset_summary

router = APIRouter(prefix="/dataset", tags=["dataset"])


# ---------------------------------------------------------------------------
# Summary & Meta endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/summary",
    response_model=DatasetSummary,
    summary="Dataset summary with entity counts and metadata",
)
def get_summary() -> DatasetSummary:
    """Return summary statistics and metadata for the CIT dataset."""
    return get_dataset_summary()


@router.get(
    "/meta",
    response_model=DatasetMeta,
    summary="Dataset metadata and entity counts (alias)",
)
def get_meta() -> DatasetMeta:
    """Return dataset metadata and entity counts."""
    ds = get_dataset()
    return DatasetMeta(
        dataset_id=ds.dataset_id,
        institute=ds.institute,
        counts={
            "rooms": len(ds.rooms),
            "faculty": len(ds.faculty),
            "student_groups": len(ds.student_groups),
            "courses": len(ds.courses),
            "sessions": len(ds.sessions),
            "booking_requests": len(ds.booking_requests),
            "cancellations": len(ds.cancellations),
            "exams": len(ds.exams),
            "room_unavailability": len(ds.room_unavailability),
        },
    )


# ---------------------------------------------------------------------------
# Core Resource Endpoints
# ---------------------------------------------------------------------------

@router.get("/rooms", response_model=list[Room], summary="All campus rooms and venues")
def list_rooms() -> list[Room]:
    """Retrieve all rooms with capacity, features, and allowed uses."""
    return get_dataset().rooms


@router.get("/rooms/{room_id}", response_model=Room, summary="Get single room by ID")
def get_room(room_id: str) -> Room:
    """Retrieve details of a single room by its unique identifier."""
    for room in get_dataset().rooms:
        if room.id == room_id:
            return room
    raise HTTPException(status_code=404, detail=f"Room '{room_id}' not found.")


@router.get("/faculty", response_model=list[Faculty], summary="All faculty members")
def list_faculty() -> list[Faculty]:
    """Retrieve all faculty members with availability and preferences."""
    return get_dataset().faculty


@router.get("/faculty/{faculty_id}", response_model=Faculty, summary="Get single faculty by ID")
def get_faculty(faculty_id: str) -> Faculty:
    """Retrieve details of a single faculty member by their unique identifier."""
    for member in get_dataset().faculty:
        if member.id == faculty_id:
            return member
    raise HTTPException(status_code=404, detail=f"Faculty '{faculty_id}' not found.")


@router.get("/sessions", response_model=list[Session], summary="All timetable sessions to schedule")
def list_sessions() -> list[Session]:
    """Retrieve all 189 teaching sessions requiring room and timeslot assignment."""
    return get_dataset().sessions


@router.get("/sessions/{session_id}", response_model=Session, summary="Get single session by ID")
def get_session(session_id: str) -> Session:
    """Retrieve details of a single session by its unique identifier."""
    for session in get_dataset().sessions:
        if session.id == session_id:
            return session
    raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")


@router.get("/groups", response_model=list[StudentGroup], summary="All student groups")
def list_groups() -> list[StudentGroup]:
    """Retrieve all student cohort groups."""
    return get_dataset().student_groups


@router.get(
    "/student-groups",
    response_model=list[StudentGroup],
    summary="All student groups (alias)",
)
def list_student_groups() -> list[StudentGroup]:
    """Alias for /groups."""
    return get_dataset().student_groups


# ---------------------------------------------------------------------------
# Additional Dataset Endpoints
# ---------------------------------------------------------------------------

@router.get("/calendar", response_model=Calendar, summary="Calendar configuration")
def get_calendar() -> Calendar:
    """Retrieve teaching days, periods, lunch hour, and exam week schedule."""
    return get_dataset().calendar


@router.get("/courses", response_model=list[Course], summary="All courses")
def list_courses() -> list[Course]:
    """Retrieve all academic courses."""
    return get_dataset().courses


@router.get(
    "/booking-requests",
    response_model=list[BookingRequest],
    summary="All fest-week booking requests",
)
def list_booking_requests() -> list[BookingRequest]:
    """Retrieve all booking requests for Spectra fest week."""
    return get_dataset().booking_requests


@router.get("/exams", response_model=list[Exam], summary="All exam definitions")
def list_exams() -> list[Exam]:
    """Retrieve all midsem exams."""
    return get_dataset().exams
