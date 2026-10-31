"""Settings and System Administration API Router.

Mounted under /api/v1/settings.
Enforces strict role-based access control (RBAC):
- Read-only diagnostics and priority inspections are available to all authenticated users.
- Administrative mutation operations (priority updates, dataset replacement, demo reset)
  strictly require the ADMIN role and reject unauthorized requests with HTTP 403 Forbidden.
"""

from __future__ import annotations

from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.models.settings import (
    DatasetApplyRequest,
    DatasetPreviewResponse,
    DemoResetResponse,
    PriorityOrderResponse,
    PriorityOrderUpdateRequest,
    SystemStatusResponse,
    ValidatorReportsResponse,
)
from app.models.user import UserResponse, UserRole
from app.routers.auth import get_current_user
from app.services.dataset_service import DatasetService, get_dataset
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"])


def require_admin(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> UserResponse:
    """Dependency that guarantees the caller holds the ADMIN role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Administrative privileges required to perform this action.",
        )
    return current_user


# ==============================================================================
# BOOKING PRIORITY MANAGEMENT
# ==============================================================================

@router.get(
    "/priority",
    response_model=PriorityOrderResponse,
    summary="Get active booking priority order",
)
def get_booking_priority(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> PriorityOrderResponse:
    """Retrieve the current 6-stage booking priority order with category metadata."""
    return SettingsService.get_priority_response()


@router.put(
    "/priority",
    response_model=PriorityOrderResponse,
    summary="Update booking priority order (Admin only)",
)
def update_booking_priority(
    payload: PriorityOrderUpdateRequest,
    admin_user: Annotated[UserResponse, Depends(require_admin)],
) -> PriorityOrderResponse:
    """Reorder the 6 booking priority stages.
    
    Persists to SQLite, syncs with memory Dataset, and logs the change to audit_log.json.
    """
    try:
        return SettingsService.save_booking_priority(
            new_order=payload.priority_order,
            admin_email=admin_user.email,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


# ==============================================================================
# DATASET MANAGEMENT
# ==============================================================================

@router.get(
    "/dataset/current",
    summary="Get current dataset metadata",
)
def get_current_dataset(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> dict[str, Any]:
    """Retrieve metadata and item counts for the active dataset."""
    ds = get_dataset()
    return {
        "dataset_id": ds.dataset_id,
        "institute": ds.institute,
        "counts": {
            "rooms": len(ds.rooms),
            "faculty": len(ds.faculty),
            "student_groups": len(ds.student_groups),
            "courses": len(ds.courses),
            "sessions": len(ds.sessions),
            "exams": len(ds.exams),
            "booking_requests": len(ds.booking_requests),
            "cancellations": len(ds.cancellations),
        },
        "priority_order": ds.priority_order,
    }


@router.post(
    "/dataset/preview",
    response_model=DatasetPreviewResponse,
    summary="Validate and preview uploaded dataset JSON (Admin only)",
)
def preview_dataset(
    payload: dict[str, Any],
    admin_user: Annotated[UserResponse, Depends(require_admin)],
) -> DatasetPreviewResponse:
    """Validate an uploaded JSON dataset against the official Pydantic schema without applying it."""
    return SettingsService.preview_dataset(payload)


@router.post(
    "/dataset/apply",
    summary="Commit validated dataset replacement (Admin only)",
)
def apply_dataset(
    payload: DatasetApplyRequest,
    admin_user: Annotated[UserResponse, Depends(require_admin)],
) -> dict[str, Any]:
    """Atomically commit a validated dataset replacement, creating a backup and invalidating cache."""
    try:
        return SettingsService.apply_dataset(
            data=payload.dataset_json,
            confirm=payload.confirm,
            admin_email=admin_user.email,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post(
    "/dataset/reload",
    summary="Reload active dataset from disk (Admin only)",
)
def reload_dataset(
    admin_user: Annotated[UserResponse, Depends(require_admin)],
) -> dict[str, Any]:
    """Force cache invalidation and reload dataset from disk."""
    DatasetService.clear_cache()
    ds = get_dataset()
    return {
        "status": "success",
        "message": f"Dataset {ds.dataset_id} reloaded successfully.",
        "counts": {
            "rooms": len(ds.rooms),
            "sessions": len(ds.sessions),
            "exams": len(ds.exams),
            "booking_requests": len(ds.booking_requests),
        },
    }


# ==============================================================================
# VALIDATOR INSPECTOR
# ==============================================================================

@router.get(
    "/validator-reports",
    response_model=ValidatorReportsResponse,
    summary="Get verified validator reports across 4 domains",
)
def get_validator_reports(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> ValidatorReportsResponse:
    """Return real outputs produced by the official starter-pack validator.py.
    
    Returns null for domains that have not yet been generated (no fake green states).
    """
    return SettingsService.get_validator_reports()


# ==============================================================================
# DEMO RESET
# ==============================================================================

@router.post(
    "/demo-reset",
    response_model=DemoResetResponse,
    summary="Reset demo environment to benchmark baseline (Admin only)",
)
def reset_demo_data(
    admin_user: Annotated[UserResponse, Depends(require_admin)],
) -> DemoResetResponse:
    """Reset mutable drafts, proposals, booking priority order, and re-seed demo accounts."""
    return SettingsService.reset_demo_data(admin_email=admin_user.email)


# ==============================================================================
# SYSTEM HEALTH & DIAGNOSTICS
# ==============================================================================

@router.get(
    "/system-status",
    response_model=SystemStatusResponse,
    summary="Live system health and diagnostic report",
)
def get_system_status(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> SystemStatusResponse:
    """Execute live operational diagnostics for API, SQLite, OR-Tools CP-SAT, and AI."""
    return SettingsService.get_system_status()


# ==============================================================================
# AUDIT LOG
# ==============================================================================

@router.get(
    "/audit-log",
    summary="Retrieve recent administrative audit log entries (Admin only)",
)
def get_audit_log(
    admin_user: Annotated[UserResponse, Depends(require_admin)],
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Retrieve audit log entries tracking priority updates, resets, and dataset replacements."""
    return SettingsService.get_audit_log(limit=limit)
