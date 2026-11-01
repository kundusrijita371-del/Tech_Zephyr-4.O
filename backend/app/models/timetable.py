"""Pydantic models for Timetable generation, solver metadata, and validation."""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class TimetableSessionAssignment(BaseModel):
    """A single scheduled session assignment conforming to the official schedule format."""
    session_id: str = Field(..., description="Unique ID of the scheduled session")
    day: str = Field(..., description="Scheduled day (MON, TUE, WED, THU, FRI)")
    start_period: int = Field(..., description="Starting teaching period (1 to 9)")
    room_id: str = Field(..., description="Assigned room identifier")
    # Enriched session fields for faculty / group / course display:
    course_id: str | None = Field(default=None, description="Course ID")
    course_title: str | None = Field(default=None, description="Course Title")
    faculty_id: str | None = Field(default=None, description="Assigned Faculty ID")
    faculty_name: str | None = Field(default=None, description="Assigned Faculty Name")
    groups: list[str] = Field(default_factory=list, description="Target Student Groups")
    kind: str | None = Field(default=None, description="Session Kind (lecture, tutorial, lab)")
    duration: int = Field(default=1, description="Duration in teaching periods")


class TimetableSchedule(BaseModel):
    """The sessions block of the official schedule.json format."""
    team: str = Field(default="HackerX", description="Team identifier")
    dataset_id: str = Field(default="cit-public-v1", description="Dataset identifier")
    sessions: list[TimetableSessionAssignment] = Field(
        default_factory=list, description="Array of all scheduled sessions"
    )


class TimetableSolverMetadata(BaseModel):
    """Detailed metadata returned by the CP-SAT timetable solver."""
    solver_status: Literal["OPTIMAL", "FEASIBLE", "INFEASIBLE", "UNKNOWN", "NOT_GENERATED"]
    solve_time_seconds: float
    scheduled_sessions: int
    total_sessions: int
    hard_violation_count: int
    soft_penalty: int
    objective_value: float | None = None
    hard_by_rule: dict[str, int] = Field(default_factory=dict)
    soft_penalties: dict[str, int] = Field(default_factory=dict)


class GenerateTimetableRequest(BaseModel):
    """Configuration payload for POST /api/v1/timetable/generate."""
    team_name: str = Field(default="HackerX", description="Configurable team name")
    time_limit_seconds: float = Field(
        default=30.0, ge=1.0, le=300.0, description="Max solve time in seconds"
    )
    num_workers: int = Field(
        default=8, ge=1, le=16, description="Parallel search workers for CP-SAT"
    )
    optimize_soft: bool = Field(
        default=True, description="Whether to optimize soft constraint objectives"
    )


class TimetableResponse(BaseModel):
    """Full API response for timetable generation and retrieval."""
    schedule: TimetableSchedule
    metadata: TimetableSolverMetadata
    violations: list[dict[str, Any]] = Field(default_factory=list)


class TimetableValidationResponse(BaseModel):
    """Response model for GET /api/v1/timetable/validation."""
    is_valid: bool
    hard_violation_count: int
    hard_violations: list[dict[str, Any]] = Field(default_factory=list)
    soft_penalty: int
    soft_penalties: dict[str, int] = Field(default_factory=dict)
    sessions_checked: int = 0
    total_sessions: int = 0

