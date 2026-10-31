"""Assistant API router exposing conversational query and intent resolution endpoints.

Mounted under /api/v1/assistant.
"""

from __future__ import annotations

from typing import Any
import uuid
from fastapi import APIRouter, HTTPException, status

from app.models.ai_schemas import (
    AssistantChatRequest,
    AssistantChatResponse,
)
from app.services.ai_service import AIService
from app.services.response_service import ResponseService

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post(
    "/chat",
    response_model=AssistantChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Process a natural language scheduling query in English or Hinglish",
)
def chat_assistant(request: AssistantChatRequest) -> AssistantChatResponse:
    """Interpret natural language intent, execute backend service queries, and return explanation."""
    cleaned_msg = request.message.strip()
    if not cleaned_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat message cannot be empty.",
        )

    cid = request.conversation_id or f"conv-{uuid.uuid4().hex[:8]}"

    try:
        ai_service = AIService()
        parsed_request = ai_service.parse_user_request(cleaned_msg)

        # Override language if user explicitly chose it
        if request.language:
            parsed_request.detected_language = request.language.lower()

        response = ResponseService.execute_and_respond(
            parsed=parsed_request,
            conversation_id=cid,
            user_role=request.user_role,
            user_id=request.user_id,
        )
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Assistant processing error: {exc}",
        ) from exc


@router.get(
    "/health",
    summary="Check AI assistant service provider status and capabilities",
)
def assistant_health() -> dict[str, Any]:
    """Report whether Gemini API or deterministic fallback engine is active."""
    service = AIService()
    is_gemini = service.is_gemini_available

    return {
        "status": "healthy",
        "provider": "gemini" if is_gemini else "deterministic_fallback",
        "model": "gemini-2.0-flash" if is_gemini else "deterministic_rules_v1",
        "supported_languages": ["English", "Hinglish"],
        "deterministic_guarantee": True,
        "capabilities": [
            "venue_availability",
            "venue_booking_evaluation",
            "timetable_query",
            "midsem_exam_lookup",
            "booking_conflict_explanation",
            "disruption_simulation",
        ],
    }
