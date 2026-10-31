"""Rescheduling models for proposals, impact analysis, versioning, and approval workflows."""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field

from app.models.disruption import DisruptionRequest


class AffectedActivity(BaseModel):
    """Details of a scheduled activity disrupted or impacted by an outage."""
    activity_type: str = Field(..., description="'session', 'exam', or 'booking'")
    activity_id: str = Field(..., description="ID of the session, exam, or booking")
    course_or_title: str = Field(default="", description="Course code or event title")
    current_day: str
    current_start_period: int | str
    current_duration: int
    current_rooms: list[str]
    faculty_id: str | None = None
    student_groups: list[str] = Field(default_factory=list)
    impact_nature: str = Field(..., description="'direct_room_conflict', 'direct_faculty_conflict', 'basket_synchronization_cascade'")


class ImpactReport(BaseModel):
    """Structured impact analysis produced when a disruption is announced."""
    disruption_id: str
    disruption_type: str
    reported_by: str
    affected_days: list[str]
    directly_affected_activities: list[AffectedActivity] = Field(default_factory=list)
    indirectly_affected_activities: list[AffectedActivity] = Field(default_factory=list)
    affected_rooms: list[str] = Field(default_factory=list)
    affected_faculty: list[str] = Field(default_factory=list)
    affected_student_groups: list[str] = Field(default_factory=list)
    affected_dates_and_periods: list[str] = Field(default_factory=list)
    total_activities_requiring_repair: int = 0
    diagnostic_summary: str = ""


class SessionChange(BaseModel):
    """Before and after assignment for a timetable session."""
    session_id: str
    course_id: str = ""
    faculty_id: str = ""
    groups: list[str] = Field(default_factory=list)
    original_day: str
    original_start_period: int
    original_room_id: str
    proposed_day: str
    proposed_start_period: int
    proposed_room_id: str
    change_type: str = Field(..., description="'room_only', 'time_and_room', 'time_only', 'unchanged'")
    reason: str = ""


class ExamChange(BaseModel):
    """Before and after assignment for an examination."""
    exam_id: str
    course_id: str = ""
    original_day: str
    original_session: str
    original_rooms: list[str]
    proposed_day: str
    proposed_session: str
    proposed_rooms: list[str]
    change_type: str = "room_only"
    reason: str = ""


class BookingChange(BaseModel):
    """Before and after assignment for a fest venue booking."""
    request_id: str
    event_name: str = ""
    original_status: str
    original_room_id: str | None = None
    original_day: str | None = None
    original_start_period: int | None = None
    proposed_status: str
    proposed_room_id: str | None = None
    proposed_day: str | None = None
    proposed_start_period: int | None = None
    reason: str = ""


class ReschedulingValidationReport(BaseModel):
    """Official validator summary for a proposed schedule repair."""
    is_valid: bool
    hard_violation_count: int
    hard_violations: list[dict[str, Any]] = Field(default_factory=list)
    soft_penalty: int
    soft_penalties: dict[str, int] = Field(default_factory=dict)
    exam_soft_penalty: int = 0
    booking_score: float = 0.0
    booking_inversions: int = 0
    sessions_moved: int = 0
    time_changed: int = 0
    room_only_changed: int = 0


class RepairProposal(BaseModel):
    """Candidate repair plan pending administrator review and approval."""
    proposal_id: str
    disruption_id: str
    baseline_schedule_id: str
    baseline_hash: str = Field(..., description="Hash of the schedule file when proposal was formed")
    status: str = Field(default="pending", description="'pending' | 'approved' | 'rejected' | 'stale'")
    solver_status: str = Field(default="UNKNOWN", description="'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN'")
    is_feasible: bool = False
    solve_time_seconds: float = 0.0
    created_at: str
    created_by: str
    approved_by: str | None = None
    decided_at: str | None = None
    decision_reason: str | None = None
    changed_sessions: list[SessionChange] = Field(default_factory=list)
    changed_exams: list[ExamChange] = Field(default_factory=list)
    changed_bookings: list[BookingChange] = Field(default_factory=list)
    unresolved_activities: list[str] = Field(default_factory=list)
    validation_report: ReschedulingValidationReport
    proposed_schedule: dict[str, Any] = Field(default_factory=dict)


class ProposalDecisionRequest(BaseModel):
    """Administrator decision payload to approve or reject a proposal."""
    decided_by: str = Field(..., min_length=2, description="Admin name or ID making decision")
    reason: str = Field(default="", description="Optional justification or comments")


class ScheduleVersionRecord(BaseModel):
    """Historical audit entry for an approved schedule modification."""
    version_id: str
    version_number: int
    disruption_id: str
    proposal_id: str
    approved_by: str
    timestamp: str
    sessions_moved_count: int
    hard_violation_count: int
    soft_penalty: int
    backup_file_path: str
    reason: str = ""

