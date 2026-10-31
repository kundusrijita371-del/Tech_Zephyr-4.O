"""Pydantic models for Examination generation, solver metadata, and validation."""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class ExamAssignmentItem(BaseModel):
    """A single scheduled examination assignment matching the official schedule format."""
    exam_id: str = Field(..., description="Unique ID of the exam, e.g. EX-MA101")
    day: str = Field(..., description="Exam day: MON, TUE, WED, THU, FRI, SAT")
    session: str = Field(..., description="Exam session: AM or PM")
    rooms: list[str] = Field(..., description="List of room IDs allocated for this exam")
    course_ids: list[str] = Field(default_factory=list, description="Course IDs associated with this exam")
    groups: list[str] = Field(default_factory=list, description="Student groups appearing for this exam")
    size: int = Field(..., description="Total student count appearing for this exam")
    effective_capacity: int = Field(..., description="Sum of half-capacities of allocated rooms")


class ExamSchedule(BaseModel):
    """The exams block of the official schedule.json format."""
    team: str = Field(default="HackerX", description="Team identifier")
    dataset_id: str = Field(default="cit-public-v1", description="Dataset identifier")
    exams: list[ExamAssignmentItem] = Field(
        default_factory=list, description="Array of all scheduled examinations"
    )


class ExamSolverMetadata(BaseModel):
    """Detailed metadata returned by the CP-SAT examination solver."""
    solver_status: Literal["OPTIMAL", "FEASIBLE", "INFEASIBLE", "UNKNOWN"]
    solve_time_seconds: float
    total_exams: int
    scheduled_exams: int
    hard_violation_count: int
    soft_penalty: int
    objective_value: float | None = None
    hard_by_rule: dict[str, int] = Field(default_factory=dict)
    rooms_used_count: int = 0
    total_capacity_provided: int = 0
    total_students_seated: int = 0


class GenerateExamRequest(BaseModel):
    """Configuration payload for POST /api/v1/exams/generate."""
    team_name: str = Field(default="HackerX", description="Configurable team name")
    time_limit_seconds: float = Field(
        default=30.0, ge=1.0, le=300.0, description="Max solve time in seconds"
    )
    num_workers: int = Field(
        default=8, ge=1, le=16, description="Parallel search workers for CP-SAT"
    )
    optimize_soft: bool = Field(
        default=True, description="Whether to minimize group same-day multi-exam penalty"
    )


class ExamResponse(BaseModel):
    """Full API response for exam generation and retrieval."""
    schedule: ExamSchedule
    metadata: ExamSolverMetadata
    violations: list[dict[str, Any]] = Field(default_factory=list)


class ExamValidationResponse(BaseModel):
    """Response model for GET /api/v1/exams/validation."""
    is_valid: bool
    hard_violation_count: int
    hard_violations: list[dict[str, Any]] = Field(default_factory=list)
    soft_penalty: int

