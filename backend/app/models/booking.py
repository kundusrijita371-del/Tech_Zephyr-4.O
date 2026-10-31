"""Pydantic models for Spectra Week venue booking engine, decisions, and validation."""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

BookingStatus = Literal["approved", "rejected", "alternative_offered"]


class BookingWindow(BaseModel):
    """A single allowable time window requested by an event organizer."""
    day: str = Field(..., description="Day of the week: MON, TUE, WED, THU, FRI")
    from_period: int = Field(..., ge=1, le=14, description="Starting period (1 to 14)")
    to_period: int = Field(..., ge=1, le=14, description="Ending period (1 to 14)")


class BookingDecision(BaseModel):
    """The official decision recorded for a booking request."""
    request_id: str = Field(..., description="Unique booking request ID, e.g. BR-01")
    status: BookingStatus = Field(..., description="Final decision status")
    day: str | None = Field(default=None, description="Assigned day if approved or alternative")
    start_period: int | None = Field(default=None, description="Starting period (1 to 13)")
    end_period: int | None = Field(default=None, description="Ending period (1 to 13)")
    room_id: str | None = Field(default=None, description="Assigned room ID")
    reason: str = Field(..., description="Human-readable explanation or justification")


class SessionOverride(BaseModel):
    """A regular timetable session displaced by an approved institute event during Week 7."""
    session_id: str = Field(..., description="ID of the displaced regular teaching session")
    day: str = Field(..., description="New rescheduled day during Week 7")
    start_period: int = Field(..., ge=1, le=9, description="New rescheduled start period")
    room_id: str = Field(..., description="New rescheduled room ID")
    displaced_by: str = Field(..., description="Request ID of the approved institute event")


class FestWeekSchedule(BaseModel):
    """The fest_week block conforming exactly to the official schedule.json format."""
    bookings: list[BookingDecision] = Field(
        default_factory=list, description="Array of all 25 booking decisions"
    )
    session_overrides: list[SessionOverride] = Field(
        default_factory=list, description="Array of Week 7 session overrides"
    )


class BookingRequestItem(BaseModel):
    """Full representation of a booking request including original data and current decision."""
    id: str
    submitted_at: str
    requester: str
    role: str
    department: str | None = None
    requested_category: str
    effective_category: str
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
    is_cancelled: bool = False
    cancellation_note: str | None = None
    decision: BookingDecision | None = None


class EvaluateBookingRequest(BaseModel):
    """Editable structured booking payload submitted for compatibility and availability evaluation."""
    request_id: str | None = None
    role: str = Field(default="club", description="Requester role: admin, faculty, department_coordinator, club")
    requested_category: str = Field(default="club_event", description="Requested category")
    attendance: int = Field(..., ge=1, description="Expected attendee count")
    duration_periods: int = Field(..., ge=1, le=13, description="Duration in periods")
    windows: list[BookingWindow] = Field(..., min_length=1, description="Requested time windows")
    room_types: list[str] = Field(..., min_length=1, description="Acceptable room types")
    needs: list[str] = Field(default_factory=list, description="Required facilities/features")
    requested_room: str | None = Field(default=None, description="Preferred room ID")
    mandatory_for_groups: list[str] = Field(default_factory=list, description="Student groups required to attend")


class RoomCompatibilityInfo(BaseModel):
    """Compatibility details for a room evaluating an event request."""
    room_id: str
    room_name: str
    room_type: str
    capacity: int = 0
    is_compatible: bool
    missing_features: list[str] = Field(default_factory=list)
    capacity_ok: bool
    type_ok: bool
    event_allowed: bool


class SlotOption(BaseModel):
    """An available time slot option for a booking."""
    day: str
    start_period: int
    end_period: int
    room_id: str
    is_inside_window: bool
    is_requested_room: bool


class EvaluateBookingResponse(BaseModel):
    """Detailed evaluation result for an event request."""
    effective_category: str
    role_cap: str
    is_feasible: bool
    compatible_rooms: list[str]
    available_slots_inside_windows: list[SlotOption]
    suggested_alternative: SlotOption | None = None
    conflicts: list[str] = Field(default_factory=list)
    recommendation: BookingDecision


class BookingValidationReport(BaseModel):
    """Official validation report returned by validator.check_bookings."""
    is_valid: bool
    hard_violation_count: int
    hard_violations: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    booking_score: float
    booking_score_max: int
    approved_count: int
    rejected_count: int
    alternative_count: int
    session_overrides_count: int
    priority_inversions: list[str] = Field(default_factory=list)


class ManualDecisionRequest(BaseModel):
    """Payload to record or override a decision for a booking request."""
    status: BookingStatus
    day: str | None = None
    start_period: int | None = None
    end_period: int | None = None
    room_id: str | None = None
    reason: str
