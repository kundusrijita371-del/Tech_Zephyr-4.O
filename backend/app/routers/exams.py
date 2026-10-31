"""Examination API router exposing generate, fetch, and validate endpoints.

Mounted under /api/v1/exams.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.exam import (
    ExamResponse,
    ExamValidationResponse,
    GenerateExamRequest,
)
from app.services.exam_service import ExamService

router = APIRouter(prefix="/exams", tags=["exams"])


@router.post(
    "/generate",
    response_model=ExamResponse,
    summary="Generate midsem examination schedule using Google OR-Tools CP-SAT",
)
def generate_exams(
    request: GenerateExamRequest | None = None,
) -> ExamResponse:
    """Run the CP-SAT engine to schedule all 41 midsem examinations without hard clashes.

    Satisfies:
    - 50% room capacity rule (multi-room allocations).
    - No room or student group double bookings.
    - Soft minimization of multiple exams per group on the same day.
    """
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

