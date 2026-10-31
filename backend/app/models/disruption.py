"""Disruption data models and input validation for CIT campus rescheduling.

Defines supported disruption categories, disruption requests, and item structures.
Compatible with both internal API workflows and official CrunchWeek validator disruptions.
"""

from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field, field_validator, model_validator


class DisruptionType(str, Enum):
    """Supported disruption categories per Milestone 05 specification."""
    ROOM_UNAVAILABLE = "ROOM_UNAVAILABLE"
    FACULTY_UNAVAILABLE = "FACULTY_UNAVAILABLE"
    ROOM_MAINTENANCE = "ROOM_MAINTENANCE"
    EXAM_ROOM_UNAVAILABLE = "EXAM_ROOM_UNAVAILABLE"
    MULTIPLE_RESOURCE_DISRUPTION = "MULTIPLE_RESOURCE_DISRUPTION"
    EVENT_PRIORITY_CONFLICT = "EVENT_PRIORITY_CONFLICT"


class DisruptionSeverity(str, Enum):
    """Disruption severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DisruptionItem(BaseModel):
    """Individual resource disruption component."""
    disruption_type: DisruptionType
    resource_id: str = Field(..., description="Room ID (e.g., 'CR-102') or Faculty ID (e.g., 'F07')")
    affected_days: list[str] = Field(default_factory=list, description="Days affected (e.g., ['MON', 'TUE'])")
    start_period: int = Field(default=1, ge=1, le=13, description="Starting period (1-9 regular, 1-13 fest)")
    end_period: int = Field(default=9, ge=1, le=13, description="Ending period (1-9 regular, 1-13 fest)")
    reason: str = Field(default="", description="Reason for the disruption")

    @field_validator("affected_days")
    @classmethod
    def validate_days(cls, v: list[str]) -> list[str]:
        valid_days = {"MON", "TUE", "WED", "THU", "FRI", "SAT"}
        cleaned = [d.upper().strip() for d in v]
        for d in cleaned:
            if d not in valid_days:
                raise ValueError(f"Invalid day '{d}'. Must be one of {valid_days}")
        return cleaned

    @model_validator(mode="after")
    def validate_period_range(self) -> DisruptionItem:
        if self.start_period > self.end_period:
            raise ValueError(
                f"start_period ({self.start_period}) cannot exceed end_period ({self.end_period})"
            )
        return self


class DisruptionRequest(BaseModel):
    """Structured request declaring an operational disruption on campus."""
    disruption_id: str = Field(..., min_length=2, description="Unique identifier for the disruption event")
    disruption_type: DisruptionType = Field(default=DisruptionType.MULTIPLE_RESOURCE_DISRUPTION, description="Primary disruption category")
    resource_id: str = Field(default="N/A", description="Primary affected Room ID or Faculty ID")
    affected_day: str | None = Field(default=None, description="Single day affected (e.g., 'MON')")
    affected_days: list[str] = Field(default_factory=list, description="List of days affected")
    start_period: int | None = Field(default=None, ge=1, le=13, description="Start period (default: 1)")
    end_period: int | None = Field(default=None, ge=1, le=13, description="End period (default: 9)")
    reason: str = Field(default="Operational disruption", min_length=2, description="Operational explanation for disruption")
    reported_by: str = Field(default="Campus Administration", min_length=2, description="Admin, Department, or Faculty member reporting")
    severity: DisruptionSeverity = Field(default=DisruptionSeverity.HIGH)
    created_at: str = Field(default="", description="ISO timestamp or date string")
    additional_items: list[DisruptionItem] = Field(
        default_factory=list,
        description="Additional resource outages for MULTIPLE_RESOURCE_DISRUPTION",
    )
    changes: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Official CrunchWeek disruption changes array (if loaded from starter-pack format)",
    )

    @model_validator(mode="after")
    def normalize_and_validate(self) -> DisruptionRequest:
        # Consolidate affected days
        days = set(self.affected_days)
        if self.affected_day:
            days.add(self.affected_day.upper().strip())
        if not days:
            # Default to all teaching days if none specified
            days = {"MON", "TUE", "WED", "THU", "FRI"}

        valid_days = {"MON", "TUE", "WED", "THU", "FRI", "SAT"}
        for d in days:
            if d not in valid_days:
                raise ValueError(f"Invalid affected day '{d}'")

        self.affected_days = sorted(list(days))

        # Default periods
        if self.start_period is None:
            self.start_period = 1
        if self.end_period is None:
            self.end_period = 9

        if self.start_period > self.end_period:
            raise ValueError(
                f"start_period ({self.start_period}) cannot be greater than end_period ({self.end_period})"
            )

        return self

    def get_all_disruption_items(self) -> list[DisruptionItem]:
        """Flatten primary disruption and any additional items or raw changes into a uniform list."""
        if self.changes:
            parsed_items: list[DisruptionItem] = []
            for ch in self.changes:
                t_str = ch.get("type", "")
                days = ch.get("days", ["MON", "TUE", "WED", "THU", "FRI"])
                pers = ch.get("periods", list(range(1, 10)))
                min_p = min(pers) if pers else 1
                max_p = max(pers) if pers else 9
                reason = ch.get("reason", "")

                if t_str == "faculty_unavailable":
                    parsed_items.append(
                        DisruptionItem(
                            disruption_type=DisruptionType.FACULTY_UNAVAILABLE,
                            resource_id=ch.get("faculty_id", ""),
                            affected_days=days,
                            start_period=min_p,
                            end_period=max_p,
                            reason=reason,
                        )
                    )
                elif t_str == "room_unavailable":
                    parsed_items.append(
                        DisruptionItem(
                            disruption_type=DisruptionType.ROOM_UNAVAILABLE,
                            resource_id=ch.get("room_id", ""),
                            affected_days=days,
                            start_period=min_p,
                            end_period=max_p,
                            reason=reason,
                        )
                    )
            if parsed_items:
                return parsed_items

        primary = DisruptionItem(
            disruption_type=self.disruption_type,
            resource_id=self.resource_id,
            affected_days=self.affected_days,
            start_period=self.start_period or 1,
            end_period=self.end_period or 9,
            reason=self.reason,
        )
        return [primary] + self.additional_items

    def to_official_changes(self) -> list[dict[str, Any]]:
        """Convert to official starter-pack validator disruption format."""
        if self.changes:
            return self.changes

        changes: list[dict[str, Any]] = []
        for item in self.get_all_disruption_items():
            periods = list(range(item.start_period, item.end_period + 1))
            t = item.disruption_type
            if t in (DisruptionType.FACULTY_UNAVAILABLE,):
                changes.append({
                    "type": "faculty_unavailable",
                    "faculty_id": item.resource_id,
                    "days": item.affected_days,
                    "periods": periods,
                    "reason": item.reason,
                })
            elif t in (
                DisruptionType.ROOM_UNAVAILABLE,
                DisruptionType.ROOM_MAINTENANCE,
                DisruptionType.EXAM_ROOM_UNAVAILABLE,
                DisruptionType.MULTIPLE_RESOURCE_DISRUPTION,
                DisruptionType.EVENT_PRIORITY_CONFLICT,
            ):
                # If resource_id looks like a faculty (e.g., F01), treat as faculty
                if item.resource_id.startswith("F") and item.resource_id[1:].isdigit():
                    changes.append({
                        "type": "faculty_unavailable",
                        "faculty_id": item.resource_id,
                        "days": item.affected_days,
                        "periods": periods,
                        "reason": item.reason,
                    })
                else:
                    changes.append({
                        "type": "room_unavailable",
                        "room_id": item.resource_id,
                        "days": item.affected_days,
                        "periods": periods,
                        "reason": item.reason,
                    })
        return changes
