"""Pydantic schemas for the CIT AI Assistant and natural language interface.

Covers parsed intents, extracted entities, structured queries, and response payloads.
Supports English and Hinglish conversational input.
"""

from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class AssistantIntent(str, Enum):
    """Supported user intents recognized by the CIT scheduling assistant."""
    VENUE_AVAILABILITY = "venue_availability"
    VENUE_BOOKING = "venue_booking"
    BOOKING_STATUS = "booking_status"
    BOOKING_EXPLANATION = "booking_explanation"
    TIMETABLE_QUERY = "timetable_query"
    EXAM_QUERY = "exam_query"
    CONFLICT_QUERY = "conflict_query"
    DISRUPTION_PREVIEW = "disruption_preview"
    GENERAL_HELP = "general_help"
    UNKNOWN = "unknown"


class ExtractedEntities(BaseModel):
    """Structured parameters extracted from natural language user prompts."""
    date: str | None = Field(default=None, description="Natural date expression or ISO date")
    day: str | None = Field(default=None, description="Standardized teaching day: 'MON'..'SAT'")
    start_period: int | None = Field(default=None, ge=1, le=13, description="Academic period (1-9 regular, 1-13 fest)")
    end_period: int | None = Field(default=None, ge=1, le=13, description="Ending academic period")
    time_str: str | None = Field(default=None, description="Natural time expression (e.g., '2 PM', '14:00', 'afternoon')")
    duration_periods: int | None = Field(default=None, ge=1, le=9, description="Duration in hours/periods")
    expected_attendance: int | None = Field(default=None, ge=1, le=1000, description="Expected attendee count")
    room_type: str | None = Field(default=None, description="Requested venue type: 'classroom', 'lecture_hall', 'auditorium', 'seminar_hall'")
    requested_room: str | None = Field(default=None, description="Specific room ID: 'CR-101', 'AUD', 'LH-1', etc.")
    faculty_id: str | None = Field(default=None, description="Faculty ID: 'F01'..'F40'")
    faculty_name: str | None = Field(default=None, description="Faculty member name")
    student_group: str | None = Field(default=None, description="Student group ID: 'CSE-3', 'Y1-A', etc.")
    course_id: str | None = Field(default=None, description="Course code or subject: 'CS201', 'Physics', etc.")
    booking_request_id: str | None = Field(default=None, description="Booking request identifier: 'BR-01'..'BR-25'")
    event_category: str | None = Field(default=None, description="'institute_event', 'guest_lecture', 'department_event', 'club_event'")
    user_role: str | None = Field(default=None, description="'admin', 'faculty', 'department_coordinator', 'club'")
    purpose: str | None = Field(default=None, description="Description of the event or request")
    accessibility_required: bool | None = Field(default=None, description="Needs ground floor or ramp/elevator access")


class ParsedAssistantRequest(BaseModel):
    """Validated output of the AI intent recognition and parameter extraction phase."""
    intent: AssistantIntent
    entities: ExtractedEntities = Field(default_factory=ExtractedEntities)
    missing_fields: list[str] = Field(default_factory=list, description="Essential fields requiring user clarification")
    clarification_question: str | None = Field(default=None, description="Prompt asking user for missing information")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score of intent recognition")
    original_message: str = Field(..., description="Original user prompt")
    detected_language: str = Field(default="en", description="'en' for English, 'hinglish' for Hindi-English mix")


class AssistantChatRequest(BaseModel):
    """User request payload sent to the assistant chat endpoint."""
    message: str = Field(..., min_length=1, max_length=2000, description="Natural language prompt")
    conversation_id: str | None = Field(default=None, description="Session conversation ID for multi-turn flow")
    language: str | None = Field(default=None, description="Optional forced language: 'en' or 'hinglish'")
    user_role: str = Field(default="faculty", description="Authenticated user role: 'admin', 'faculty', 'department_coordinator', 'club'")
    user_id: str | None = Field(default=None, description="Authenticated user ID")


class AssistantChatResponse(BaseModel):
    """Structured response returned by the assistant chat endpoint."""
    conversation_id: str
    message: str = Field(..., description="Conversational explanation or answer")
    intent: str
    extracted_entities: dict[str, Any] = Field(default_factory=dict)
    requires_clarification: bool = False
    clarification_question: str | None = None
    action_result: dict[str, Any] | None = None
    references: list[dict[str, Any]] = Field(default_factory=list, description="IDs of relevant sessions, rooms, or bookings")
    suggested_actions: list[str] = Field(default_factory=list, description="Follow-up quick suggestions for user")

