"""Pydantic v2 models for every entity in cit_public.json.

Field names exactly match the JSON keys. Models are used for:
  - Validating the dataset on load (fail-fast).
  - API response serialisation.
  - Type hints across the codebase.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Calendar
# ---------------------------------------------------------------------------

class Period(BaseModel):
    id: int
    start: str
    end: str
    teaching: bool


class ExamSession(BaseModel):
    id: str  # "AM" | "PM"
    start: str
    end: str


class ExamWeek(BaseModel):
    days: list[str]
    sessions: list[ExamSession]


class Lunch(BaseModel):
    after_period: int
    start: str
    end: str


class Calendar(BaseModel):
    days: list[str]
    periods: list[Period]
    lunch: Lunch
    lab_start_periods: list[int]
    event_only_periods: list[int]
    fest_week: str
    exam_week: ExamWeek


# ---------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------

RoomType = Literal[
    "classroom",
    "lecture_hall",
    "auditorium",
    "seminar_hall",
    "outdoor",
    "lab_cs",
    "lab_elec",
    "lab_phy",
    "workshop",
    "lab_civil",
]

AllowedUse = Literal["lecture", "tutorial", "lab", "exam", "event"]


class Room(BaseModel):
    id: str
    name: str
    building: str
    type: RoomType
    capacity: int
    features: list[str]
    accessible: bool
    allowed_uses: list[AllowedUse]


class RoomUnavailability(BaseModel):
    room_id: str
    day: str
    periods: list[int]
    reason: str


# ---------------------------------------------------------------------------
# Faculty
# ---------------------------------------------------------------------------

class FacultyPreference(BaseModel):
    type: str  # e.g. "avoid"
    days: list[str]
    periods: list[int]
    note: str


class FacultyUnavailableSlot(BaseModel):
    day: str
    periods: list[int]


class Faculty(BaseModel):
    id: str
    name: str
    department: str
    max_hours_per_day: int
    needs_accessible: bool
    unavailable: list[FacultyUnavailableSlot]
    preferences: list[FacultyPreference]


# ---------------------------------------------------------------------------
# Student Groups
# ---------------------------------------------------------------------------

class StudentGroup(BaseModel):
    id: str
    name: str
    year: int
    department: str
    size: int
    needs_accessible: bool


# ---------------------------------------------------------------------------
# Courses
# Note: JSON uses "title" (not "name") and includes a "year" field.
# ---------------------------------------------------------------------------

class Course(BaseModel):
    id: str
    title: str
    department: str
    year: int
    lecture_hours: int
    tutorial_hours: int
    lab_blocks: int


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

SessionKind = Literal["lecture", "tutorial", "lab"]


class FixedSlot(BaseModel):
    day: str
    start_period: int


class Session(BaseModel):
    id: str
    course_id: str
    kind: SessionKind
    groups: list[str]
    faculty_id: str
    size: int
    duration: int
    room_types: list[str]
    needs_accessible: bool
    basket_slot: str | None = None
    fixed_slot: FixedSlot | None = None


# ---------------------------------------------------------------------------
# Booking Requests (Spectra / fest week)
# ---------------------------------------------------------------------------

class BookingWindow(BaseModel):
    day: str
    from_period: int
    to_period: int


class BookingRequest(BaseModel):
    id: str
    submitted_at: str
    requester: str
    role: str
    requested_category: str
    title: str
    attendance: int
    duration_periods: int
    windows: list[BookingWindow]
    room_types: list[str]
    needs: list[str]
    requested_room: str | None = None
    mandatory_for_groups: list[str]
    series_id: str | None = None
    raw_text: str


# ---------------------------------------------------------------------------
# Cancellations
# Note: JSON cancellations is a list of objects, not a list of strings.
# ---------------------------------------------------------------------------

class Cancellation(BaseModel):
    request_id: str
    cancelled_at: str
    by: str
    note: str


# ---------------------------------------------------------------------------
# Exams
# ---------------------------------------------------------------------------

class Exam(BaseModel):
    id: str
    course_ids: list[str]
    groups: list[str]
    size: int
    duration_hours: float


# ---------------------------------------------------------------------------
# Top-level dataset
# ---------------------------------------------------------------------------

class Dataset(BaseModel):
    dataset_id: str
    institute: str
    calendar: Calendar
    priority_order: list[str]
    role_category_cap: dict[str, str]
    rooms: list[Room]
    room_unavailability: list[RoomUnavailability]
    faculty: list[Faculty]
    student_groups: list[StudentGroup]
    courses: list[Course]
    sessions: list[Session]
    booking_requests: list[BookingRequest]
    cancellations: list[Cancellation]
    exams: list[Exam]


# ---------------------------------------------------------------------------
# API response models
# ---------------------------------------------------------------------------

class DatasetSummary(BaseModel):
    dataset_id: str
    institute: str
    total_rooms: int
    total_faculty: int
    total_student_groups: int
    total_courses: int
    total_sessions: int
    total_booking_requests: int
    total_cancellations: int
    total_exams: int
    total_room_unavailability: int


class DatasetMeta(BaseModel):
    dataset_id: str
    institute: str
    counts: dict[str, int]
