"""Examination API router exposing generate, fetch, and validate endpoints.

Mounted under /api/v1/exams.
"""

from __future__ import annotations

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status

from app.models.exam import (
    ExamResponse,
    ExamValidationResponse,
    GenerateExamRequest,
)
from app.models.user import UserResponse, UserRole
from app.routers.auth import get_current_user_optional
from app.services.exam_service import ExamService

router = APIRouter(prefix="/exams", tags=["exams"])


@router.post(
    "/generate",
    response_model=ExamResponse,
    summary="Generate midsem examination schedule using Google OR-Tools CP-SAT",
)
def generate_exams(
    request: GenerateExamRequest | None = None,
    current_user: Annotated[UserResponse | None, Depends(get_current_user_optional)] = None,
) -> ExamResponse:
    """Run the CP-SAT engine to schedule all midsem examinations without hard clashes.

    Restricted to Campus Administrators.
    """
    if current_user and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Midsem examination hall scheduling requires administrative privileges.",
        )

    req = request or GenerateExamRequest()
    response = ExamService.generate(req)

    if response.metadata.solver_status not in ("OPTIMAL", "FEASIBLE"):
        raise HTTPException(
            status_code=422,
            detail={
                "message": f"CP-SAT solver returned {response.metadata.solver_status}",
                "metadata": response.metadata.model_dump(),
                "violations": response.violations,
            },
        )

    return response


@router.get(
    "",
    response_model=ExamResponse,
    summary="Get the most recently generated examination schedule",
)
def get_latest_exams() -> ExamResponse:
    """Retrieve the latest generated examination schedule.

    Returns 404 if no examination schedule has been generated yet.
    """
    latest = ExamService.get_latest()
    if latest is None:
        raise HTTPException(
            status_code=404,
            detail="No exam schedule generated yet. Call POST /api/v1/exams/generate first.",
        )
    return latest


@router.get(
    "/validation",
    response_model=ExamValidationResponse,
    summary="Validate the latest examination schedule using the official validator",
)
def get_exam_validation() -> ExamValidationResponse:
    """Evaluate the current exam schedule against official validator.py rules."""
    validation = ExamService.get_validation()
    if validation is None:
        raise HTTPException(
            status_code=404,
            detail="No exam schedule generated yet. Call POST /api/v1/exams/generate first.",
        )
    return validation

