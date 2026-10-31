"""AI Service provider integration with Google Gemini and deterministic fallback.

Orchestrates intent parsing via Gemini when credentials are configured, and gracefully
falls back to the deterministic IntentService whenever the API key is absent or offline.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from app.models.ai_schemas import (
    AssistantIntent,
    ExtractedEntities,
    ParsedAssistantRequest,
)
from app.services.intent_service import IntentService

logger = logging.getLogger(__name__)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


class AIService:
    """Natural language interpretation provider for campus scheduling."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.timeout = float(os.getenv("AI_TIMEOUT_SECONDS", "5.0"))

    @property
    def is_gemini_available(self) -> bool:
        """True if Gemini API key is configured."""
        return bool(self.api_key and self.api_key.strip() and not self.api_key.startswith("mock_"))

    def parse_user_request(self, message: str) -> ParsedAssistantRequest:
        """Parse natural language message into structured intent and entities."""
        # 1. If Gemini API is configured, attempt LLM parse
        if self.is_gemini_available:
            try:
                return self._parse_with_gemini(message)
            except Exception as exc:
                logger.warning(
                    "Gemini API interpretation failed (%s). Falling back to deterministic parser.",
                    exc,
                )

        # 2. Deterministic fallback parser (guarantees offline/test resilience)
        return IntentService.parse_deterministic(message)

    def _parse_with_gemini(self, message: str) -> ParsedAssistantRequest:
        """Invoke Gemini 2.0 Flash to extract structured intent and entities."""
        system_prompt = (
            "You are an assistant for CIT Campus Scheduling. Parse user messages in English or Hinglish into JSON.\n"
            "Intents: venue_availability, venue_booking, booking_status, booking_explanation, "
            "timetable_query, exam_query, conflict_query, disruption_preview, general_help, unknown.\n"
            "Return valid JSON matching this schema:\n"
            "{\n"
            '  "intent": "venue_availability",\n'
            '  "entities": {\n'
            '    "day": "MON"|"TUE"|"WED"|"THU"|"FRI"|"SAT"|null,\n'
            '    "start_period": int (1-13) | null,\n'
            '    "expected_attendance": int | null,\n'
            '    "room_type": "seminar_hall"|"classroom"|"lecture_hall"|"auditorium"|null,\n'
            '    "requested_room": "CR-102"|null,\n'
            '    "faculty_id": "F01"|null,\n'
            '    "student_group": "CSE-3"|null,\n'
            '    "course_id": "CS201"|null,\n'
            '    "booking_request_id": "BR-04"|null\n'
            "  },\n"
            '  "missing_fields": ["attendance", ...],\n'
            '  "clarification_question": "..." | null,\n'
            '  "confidence": 0.95,\n'
            '  "detected_language": "en"|"hinglish"\n'
            "}"
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": f"{system_prompt}\n\nUser message: {message}"}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json",
            },
        }

        url = f"{GEMINI_API_URL}?key={self.api_key}"
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        text_content = data["candidates"][0]["content"]["parts"][0]["text"]
        raw_json = json.loads(text_content)

        raw_intent = raw_json.get("intent", "unknown")
        try:
            intent_enum = AssistantIntent(raw_intent)
        except ValueError:
            intent_enum = AssistantIntent.UNKNOWN

        entities = ExtractedEntities.model_validate(raw_json.get("entities", {}))

        return ParsedAssistantRequest(
            intent=intent_enum,
            entities=entities,
            missing_fields=raw_json.get("missing_fields", []),
            clarification_question=raw_json.get("clarification_question"),
            confidence=float(raw_json.get("confidence", 0.9)),
            original_message=message,
            detected_language=raw_json.get("detected_language", "en"),
        )

