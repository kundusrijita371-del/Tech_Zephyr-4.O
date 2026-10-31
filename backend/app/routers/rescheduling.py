"""Rescheduling API router exposing disruption management, impact analysis, proposals, and approval.

Mounted under /api/v1/rescheduling.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.models.disruption import DisruptionRequest
from app.models.rescheduling import (
    ImpactReport,
    ProposalDecisionRequest,
    RepairProposal,
    ScheduleVersionRecord,
)
from app.models.user import UserResponse, UserRole
from app.routers.auth import get_current_user_optional
from app.services.rescheduling_service import ReschedulingService

router = APIRouter(prefix="/rescheduling", tags=["rescheduling"])


@router.post(
    "/preview",
    response_model=RepairProposal,
    status_code=status.HTTP_200_OK,
    summary="Accept a disruption request and produce a repair proposal",
)
def create_repair_preview(request: DisruptionRequest) -> RepairProposal:
    """Analyze the impact of a disruption and formulate a minimal-change schedule repair."""
    try:
        return ReschedulingService.create_preview(request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to generate repair preview: {exc}",
        ) from exc


@router.get(
    "/impact/{disruption_id}",
    response_model=ImpactReport,
    summary="Return the impact analysis for a disruption",
)
def get_impact_analysis(disruption_id: str) -> ImpactReport:
    """Fetch the blast radius analysis for the given disruption ID."""
    report = ReschedulingService.get_impact_analysis(disruption_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Impact report for disruption '{disruption_id}' not found.",
        )
    return report


@router.get(
    "/proposals",
    response_model=list[RepairProposal],
    summary="List pending and historical repair proposals",
)
def list_proposals() -> list[RepairProposal]:
    """List all repair proposals in reverse chronological order."""
    return ReschedulingService.list_proposals()


@router.get(
    "/proposals/{proposal_id}",
    response_model=RepairProposal,
    summary="Return detailed before-and-after changes for a proposal",
)
def get_proposal_details(proposal_id: str) -> RepairProposal:
    """Retrieve detailed metadata, activity diffs, and validation report for a proposal."""
    proposal = ReschedulingService.get_proposal(proposal_id)
    if proposal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repair proposal '{proposal_id}' not found.",
        )
    return proposal


@router.post(
    "/proposals/{proposal_id}/approve",
    response_model=ScheduleVersionRecord,
    summary="Approve and atomically commit a validated proposal",
)
def approve_proposal(
    proposal_id: str,
    decision: ProposalDecisionRequest,
    current_user: Annotated[UserResponse | None, Depends(get_current_user_optional)] = None,
) -> ScheduleVersionRecord:
    """Commit a pending repair proposal. Verifies schedule integrity and archives previous version."""
    if current_user:
        if current_user.role not in (UserRole.ADMIN, UserRole.DEPARTMENT_COORDINATOR):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Only Campus Administrators and Department Coordinators can approve schedule rescheduling proposals.",
            )
        # Prevent self-approval if coordinator requested the disruption
        proposal = ReschedulingService.get_proposal(proposal_id)
        if proposal and current_user.role != UserRole.ADMIN:
            # Check if current user is the requester
            if hasattr(proposal, "disruption") and getattr(proposal.disruption, "reported_by", None) == current_user.email:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Self-approval is strictly prohibited. An administrator must approve your proposal.",
                )

    try:
        return ReschedulingService.approve_proposal(proposal_id, decision)
    except ValueError as exc:
        msg = str(exc)
        if "Stale proposal" in msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=msg,
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        ) from exc


@router.post(
    "/proposals/{proposal_id}/reject",
    response_model=RepairProposal,
    summary="Reject a pending proposal without changing the active schedule",
)
def reject_proposal(
    proposal_id: str,
    decision: ProposalDecisionRequest,
    current_user: Annotated[UserResponse | None, Depends(get_current_user_optional)] = None,
) -> RepairProposal:
    """Reject a repair proposal. Keeps the active schedule completely untouched."""
    if current_user:
        if current_user.role not in (UserRole.ADMIN, UserRole.DEPARTMENT_COORDINATOR):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Only Campus Administrators and Department Coordinators can reject schedule rescheduling proposals.",
            )

    try:
        return ReschedulingService.reject_proposal(proposal_id, decision)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/history",
    response_model=list[ScheduleVersionRecord],
    summary="Return previous disruptions and approved schedule changes",
)
def get_schedule_history() -> list[ScheduleVersionRecord]:
    """Retrieve the versioned audit trail of all approved schedule changes."""
    return ReschedulingService.get_history()

