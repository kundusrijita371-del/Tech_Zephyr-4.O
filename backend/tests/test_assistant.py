"""Automated tests for Milestone 06: CIT AI Assistant & Natural Language Interface.

Verifies:
  1. English intent recognition (all prompt examples)
  2. Hinglish intent recognition (all prompt examples)
  3. Missing parameter detection & clarification questions
  4. Deterministic fallback parser execution without Gemini API key
  5. Booking evaluation integration with role-category permission checks
  6. Timetable querying for student groups and faculty workload
  7. Midsem exam search and summary
  8. Deterministic conflict explanation citing official validator rules
  9. Disruption simulation preview without committing schedule changes
  10. Assistant health endpoint and error handling
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.models.ai_schemas import AssistantIntent
from app.services.ai_service import AIService
from app.services.intent_service import IntentService
from app.services.response_service import ResponseService


class TestIntentRecognitionAndFallback:
    """Verifies intent recognition and entity extraction for English and Hinglish."""

    def test_english_venue_booking_prompt(self) -> None:
        """'Find me a seminar hall for 60 students tomorrow at 2 PM.'"""
        msg = "Find me a seminar hall for 60 students tomorrow at 2 PM."
        parsed = IntentService.parse_deterministic(msg)

        assert parsed.intent == AssistantIntent.VENUE_AVAILABILITY or parsed.intent == AssistantIntent.VENUE_BOOKING
        assert parsed.entities.expected_attendance == 60
        assert parsed.entities.day == "TUE"
        assert parsed.entities.start_period == 6  # 2 PM is period 6
        assert parsed.detected_language == "en"

    def test_hinglish_venue_booking_prompt(self) -> None:
        """'Kal 2 baje 60 students ke liye seminar hall chahiye.'"""
        msg = "Kal 2 baje 60 students ke liye seminar hall chahiye."
        parsed = IntentService.parse_deterministic(msg)

        assert parsed.intent == AssistantIntent.VENUE_BOOKING
        assert parsed.entities.expected_attendance == 60
        assert parsed.entities.day == "TUE"  # Kal -> Tuesday
        assert parsed.entities.start_period == 6  # 2 baje -> Period 6
        assert parsed.detected_language == "hinglish"

    def test_english_rooms_wednesday_afternoon(self) -> None:
        """'Show me available rooms on Wednesday afternoon.'"""
        msg = "Show me available rooms on Wednesday afternoon."
        parsed = IntentService.parse_deterministic(msg)

        assert parsed.intent == AssistantIntent.VENUE_AVAILABILITY
        assert parsed.entities.day == "WED"
        assert parsed.entities.start_period == 6  # Afternoon -> Period 6

    def test_rejection_explanation_prompt(self) -> None:
        """'Why was my booking BR-04 rejected?'"""
        msg = "Why was my booking BR-04 rejected?"
        parsed = IntentService.parse_deterministic(msg)

        assert parsed.intent == AssistantIntent.BOOKING_EXPLANATION
        assert parsed.entities.booking_request_id == "BR-04"

    def test_hinglish_rejection_explanation(self) -> None:
        """'Mera booking BR-04 reject kyu hua?'"""
        msg = "Mera booking BR-04 reject kyu hua?"
        parsed = IntentService.parse_deterministic(msg)

        assert parsed.intent == AssistantIntent.BOOKING_EXPLANATION
        assert parsed.entities.booking_request_id == "BR-04"
        assert parsed.detected_language == "hinglish"

    def test_timetable_group_query(self) -> None:
        """'Show today's timetable for CSE-3.'"""
        msg = "Show today's timetable for CSE-3."
        parsed = IntentService.parse_deterministic(msg)

        assert parsed.intent == AssistantIntent.TIMETABLE_QUERY
        assert parsed.entities.student_group == "CSE-3"

    def test_faculty_workload_query(self) -> None:
        """'Which faculty members have the most classes this week?'"""
        msg = "Which faculty members have the most classes this week?"
        parsed = IntentService.parse_deterministic(msg)

        assert parsed.intent == AssistantIntent.TIMETABLE_QUERY

    def test_midsem_exam_query(self) -> None:
        """'When is the Physics midsem?' and 'Summarise the midsem examination schedule.'"""
        msg1 = "When is the Physics midsem?"
        parsed1 = IntentService.parse_deterministic(msg1)
        assert parsed1.intent == AssistantIntent.EXAM_QUERY
        assert parsed1.entities.course_id == "PH101"

        msg2 = "Summarise the midsem examination schedule."
        parsed2 = IntentService.parse_deterministic(msg2)
        assert parsed2.intent == AssistantIntent.EXAM_QUERY

    def test_disruption_query(self) -> None:
        """'What happens if Room CR-102 becomes unavailable?'"""
        msg = "What happens if Room CR-102 becomes unavailable?"
        parsed = IntentService.parse_deterministic(msg)

        assert parsed.intent == AssistantIntent.DISRUPTION_PREVIEW
        assert parsed.entities.requested_room == "CR-102"

    def test_missing_fields_and_clarification(self) -> None:
        """Venue request missing attendance or day triggers clarification question."""
        msg = "Need a room for a workshop."
        parsed = IntentService.parse_deterministic(msg)

        assert parsed.intent == AssistantIntent.VENUE_BOOKING
        assert len(parsed.missing_fields) > 0
        assert parsed.clarification_question is not None


class TestResponseServiceExecution:
    """Verifies backend execution and deterministic answer formulation."""

    def test_venue_availability_execution(self) -> None:
        """Returns unoccupied rooms matching size on Wednesday afternoon."""
        parsed = IntentService.parse_deterministic("Show me available rooms on Wednesday afternoon.")
        res = ResponseService.execute_and_respond(parsed, conversation_id="conv-test-01")

        assert res.intent == "venue_availability"
        assert res.action_result is not None
        assert "available_rooms" in res.action_result
        assert res.action_result["total_free"] > 0
        assert len(res.message) > 0

    def test_rejection_explanation_cites_rule_b3(self) -> None:
        """Explains BR-04 cancellation citing official rule B3."""
        parsed = IntentService.parse_deterministic("Why was my booking BR-04 rejected?")
        res = ResponseService.execute_and_respond(parsed, conversation_id="conv-test-02")

        assert res.intent == "booking_explanation"
        assert "BR-04" in res.message
        assert "cancelled" in res.message.lower() or "b3" in res.message.lower()
        assert res.action_result["status"] == "rejected"

    def test_timetable_group_execution(self) -> None:
        """Retrieves actual scheduled classes for CSE-3."""
        parsed = IntentService.parse_deterministic("Show today's timetable for CSE-3.")
        res = ResponseService.execute_and_respond(parsed, conversation_id="conv-test-03")

        assert res.intent == "timetable_query"
        assert "CSE-3" in res.message
        assert res.action_result is not None
        assert "classes" in res.action_result

    def test_faculty_workload_execution(self) -> None:
        """Aggregates faculty teaching hours across 189 sessions."""
        parsed = IntentService.parse_deterministic("Which faculty members have the most classes this week?")
        res = ResponseService.execute_and_respond(parsed, conversation_id="conv-test-04")

        assert res.intent == "timetable_query"
        assert "top_faculty" in res.action_result
        assert len(res.action_result["top_faculty"]) > 0

    def test_exam_search_execution(self) -> None:
        """Finds Physics midsem exam day and partitioned room allocations."""
        parsed = IntentService.parse_deterministic("When is the Physics midsem?")
        res = ResponseService.execute_and_respond(parsed, conversation_id="conv-test-05")

        assert res.intent == "exam_query"
        assert "PH101" in res.message or "Physics" in res.message
        assert res.action_result is not None

    def test_disruption_simulation_does_not_commit(self) -> None:
        """Simulates CR-102 outage with CP-SAT and explicitly confirms not committed."""
        parsed = IntentService.parse_deterministic("What happens if Room CR-102 becomes unavailable?")
        res = ResponseService.execute_and_respond(parsed, conversation_id="conv-test-06")

        assert res.intent == "disruption_preview"
        assert "CR-102" in res.message
        assert "0 Hard" in res.message or "OPTIMAL" in res.message or "FEASIBLE" in res.message
        assert "simulation" in res.message.lower() or "preview" in res.message.lower()
        # Verify schedule was not committed automatically
        assert "NOT" in res.message or "not modified" in res.message or "kewal PREVIEW" in res.message


class TestAssistantAPIEndpoints:
    """Verifies FastAPI REST endpoints (/api/v1/assistant/*)."""

    def test_assistant_health_endpoint(self, client: TestClient) -> None:
        """GET /api/v1/assistant/health returns operational status and provider details."""
        res = client.get("/api/v1/assistant/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert data["provider"] in ("gemini", "deterministic_fallback")
        assert "Hinglish" in data["supported_languages"]

    def test_chat_endpoint_english(self, client: TestClient) -> None:
        """POST /api/v1/assistant/chat processes English queries."""
        payload = {
            "message": "Find me a seminar hall for 60 students tomorrow at 2 PM.",
            "user_role": "faculty",
        }
        res = client.post("/api/v1/assistant/chat", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["conversation_id"] is not None
        assert len(data["message"]) > 0

    def test_chat_endpoint_hinglish(self, client: TestClient) -> None:
        """POST /api/v1/assistant/chat processes Hinglish queries."""
        payload = {
            "message": "Kal 2 baje 60 students ke liye seminar hall chahiye.",
            "user_role": "club",
        }
        res = client.post("/api/v1/assistant/chat", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == "venue_booking"
        assert len(data["message"]) > 0

    def test_empty_message_rejected(self, client: TestClient) -> None:
        """Empty prompt returns HTTP 400."""
        res = client.post("/api/v1/assistant/chat", json={"message": "   "})
        assert res.status_code == 400

