"""Pydantic schemas for the Settings and System Management module."""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class CategoryInfo(BaseModel):
    """Metadata describing a booking priority category."""
    id: str
    name: str
    rank: int
    description: str
    official_role_cap: str


class PriorityOrderUpdateRequest(BaseModel):
    """Payload to update the 6-stage booking priority order."""
    priority_order: list[str] = Field(
        ...,
        description="Strictly ordered list of the 6 booking priority categories",
        min_length=6,
        max_length=6,
    )


class PriorityOrderResponse(BaseModel):
    """Response containing the saved priority order and category metadata."""
    priority_order: list[str]
    categories: list[CategoryInfo]
    updated_at: str | None = None
    updated_by: str | None = None
    is_default: bool = False


class DatasetPreviewResponse(BaseModel):
    """Validation preview response for uploaded datasets."""
    is_valid: bool
    dataset_id: str
    institute: str
    counts: dict[str, int]
    validation_errors: list[str] = []


class DatasetApplyRequest(BaseModel):
    """Request payload to commit a verified dataset replacement."""
    dataset_json: dict[str, Any]
    confirm: bool = Field(False, description="Explicit confirmation required to replace active dataset")


class SystemStatusResponse(BaseModel):
    """System health and operational diagnostic metrics."""
    backend: dict[str, Any]
    database: dict[str, Any]
    solver: dict[str, Any]
    ai: dict[str, Any]
    dataset: dict[str, Any]
    timetable_generated: bool
    exams_generated: bool
    bookings_generated: bool
    rescheduling_active: bool


class ValidatorReportsResponse(BaseModel):
    """Real validation reports across all 4 scheduling domains."""
    timetable: dict[str, Any] | None = None
    exams: dict[str, Any] | None = None
    bookings: dict[str, Any] | None = None
    disruptions: dict[str, Any] | None = None


class DemoResetResponse(BaseModel):
    """Outcome report following a judge demo reset operation."""
    status: str
    message: str
    reset_timestamp: str
    reset_by: str
    restored_entities: list[str]

