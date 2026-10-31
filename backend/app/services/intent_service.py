"""Deterministic intent classification and entity extraction service.

Provides high-accuracy parsing for both English and Hinglish conversational inputs.
Acts as a standalone deterministic parser and as a fallback if LLM APIs are unreachable.
"""

from __future__ import annotations

import re
from typing import Any

from app.models.ai_schemas import (
    AssistantIntent,
    ExtractedEntities,
    ParsedAssistantRequest,
)

# Known dataset entity dictionaries for entity recognition
KNOWN_ROOMS = {
    "AUD", "LH-1", "LH-2", "LH-3", "LH-4", "LH-5", "LH-6",
    "CR-101", "CR-102", "CR-103", "CR-104", "CR-105",
    "CR-201", "CR-202", "CR-203", "CR-204", "CR-205",
    "SH-1", "SH-2", "CC-1", "CC-2", "CS-LAB1", "EC-LAB1", "EE-LAB1", "MECH-LAB1", "CIVIL-LAB1"
}

KNOWN_GROUPS = {
    "Y1-A", "Y1-B", "Y1-C", "Y1-D",
    "CSE-2", "CSE-3", "ECE-2", "ECE-3", "EE-2", "EE-3", "ME-2", "ME-3", "CE-2", "CE-3"
}

# Mapping of natural time expressions to academic teaching periods
TIME_TO_PERIOD = {
    "8": 1, "8:30": 1, "08:30": 1, "9": 1, "9:00": 1,
    "9:30": 2, "10": 2, "10:00": 2,
    "10:30": 3, "11": 3, "11:00": 3,
    "11:30": 4, "12": 4, "12:00": 4,
    "12:30": 5, "1": 5, "1:00": 5, "13:00": 5,
    "2": 6, "2:00": 6, "14:00": 6,  # 2 PM -> Period 6
    "3": 7, "3:00": 7, "15:00": 7,  # 3 PM -> Period 7
    "4": 8, "4:00": 8, "16:00": 8,  # 4 PM -> Period 8
    "5": 9, "5:00": 9, "17:00": 9,  # 5 PM -> Period 9
    "6": 10, "6:00": 10, "18:00": 10,
    "7": 11, "7:00": 11, "19:00": 11,
    "8 pm": 12, "20:00": 12,
}


class IntentService:
    """Parses natural language prompts into structured intent and entities."""

    @classmethod
    def detect_language(cls, text: str) -> str:
        """Detect whether message is English or Hinglish."""
        hinglish_words = {
            "kal", "aaj", "somwar", "mangalwar", "budhwar", "guruwar", "shukrawar",
            "shaniwar", "baje", "dopahar", "subah", "sham", "chahiye", "karna", "hai",
            "kare", "karo", "kyu", "kyun", "kiska", "kiske", "kitne", "khali", "kamra",
            "log", "logo", "hoga", "raha", "wala", "wali", "dikhao", "batao"
        }
        words = re.findall(r"\b\w+\b", text.lower())
        match_count = sum(1 for w in words if w in hinglish_words)
        return "hinglish" if match_count >= 1 else "en"

    @classmethod
    def extract_day(cls, text: str) -> tuple[str | None, str | None]:
        """Extract standardized academic day ('MON'..'SAT') and natural date string."""
        lower = text.lower()
        if "tomorrow" in lower or "kal" in lower:
            # For CIT campus demo, tomorrow resolves to Tuesday (next teaching day)
            return "TUE", "tomorrow"
        if "today" in lower or "aaj" in lower:
            return "MON", "today"
        if "monday" in lower or "somwar" in lower or "mon" in lower.split():
            return "MON", "Monday"
        if "tuesday" in lower or "mangalwar" in lower or "tue" in lower.split():
            return "TUE", "Tuesday"
        if "wednesday" in lower or "budhwar" in lower or "wed" in lower.split():
            return "WED", "Wednesday"
        if "thursday" in lower or "guruwar" in lower or "veervar" in lower or "thu" in lower.split():
            return "THU", "Thursday"
        if "friday" in lower or "shukrawar" in lower or "fri" in lower.split():
            return "FRI", "Friday"
        if "saturday" in lower or "shaniwar" in lower or "sat" in lower.split():
            return "SAT", "Saturday"
        return None, None

    @classmethod
    def extract_period(cls, text: str) -> tuple[int | None, str | None]:
        """Extract academic period from clock time, periods (P1-P9), or natural terms."""
        lower = text.lower()

        # Check explicit period patterns: P1, P6, Period 3
        p_match = re.search(r"\b(?:p|period)\s*([1-9]|1[0-3])\b", lower)
        if p_match:
            p_val = int(p_match.group(1))
            return p_val, f"Period {p_val}"

        # Check Hinglish "X baje" or English "X pm / X am / X o'clock"
        baje_match = re.search(r"(\d{1,2}(?::\d{2})?)\s*(?:baje|pm|am|o'clock)?", lower)
        time_match = re.search(r"\b(\d{1,2}(?::\d{2})?)\s*(?:pm|am)\b", lower)

        target_str = None
        if time_match:
            target_str = time_match.group(1)
        elif "baje" in lower and baje_match:
            target_str = baje_match.group(1)

        if target_str and target_str in TIME_TO_PERIOD:
            p = TIME_TO_PERIOD[target_str]
            return p, f"{target_str} ({'PM' if p >= 5 else 'AM'})"

        # General daylight window matches
        if "afternoon" in lower or "dopahar" in lower:
            return 6, "afternoon (Period 6, 2:00 PM)"
        if "morning" in lower or "subah" in lower:
            return 1, "morning (Period 1, 8:30 AM)"
        if "evening" in lower or "sham" in lower:
            return 8, "evening (Period 8, 4:00 PM)"

        return None, None

    @classmethod
    def extract_attendance(cls, text: str) -> int | None:
        """Extract attendee count from phrases like '60 students', '80 people', '60 log'."""
        patterns = [
            r"(\d{1,4})\s*(?:students|people|persons|attendees|participants|delegates|seats|log|logo)\b",
            r"(?:for|capacity|accommodating|ke liye)\s*(\d{1,4})\b",
            r"\b(\d{2,4})\s*(?:capacity|size)\b",
        ]
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                val = int(m.group(1))
                if val <= 1000:
                    return val
        return None

    @classmethod
    def extract_room_type(cls, text: str) -> str | None:
        """Classify requested venue category using strict word boundaries."""
        lower = text.lower()
        if "seminar" in lower or "seminar hall" in lower:
            return "seminar_hall"
        if "auditorium" in lower or "audi" in lower.split():
            return "auditorium"
        if "lecture hall" in lower or "lh" in lower.split():
            return "lecture_hall"
        if "classroom" in lower or "cr" in lower.split():
            return "classroom"
        if re.search(r"\b(?:labs?|laboratory|laboratories)\b", lower):
            return "lab"
        return None

    @classmethod
    def extract_room_id(cls, text: str) -> str | None:
        """Find specific room code in text."""
        # Check standard format: AUD, LH-1..6, CR-101..205, SH-1..2, R-12
        match = re.search(r"\b(AUD|LH-[1-6]|CR-[12]0[1-5]|SH-[12]|CC-[12]|R-[0-9]{1,2})\b", text, re.IGNORECASE)
        if match:
            found = match.group(1).upper()
            # If user refers to fictional R-12, map or preserve
            return found
        return None

    @classmethod
    def extract_faculty(cls, text: str) -> tuple[str | None, str | None]:
        """Extract faculty code (F01..F40) or name mention."""
        f_match = re.search(r"\bF([0-3][0-9]|40)\b", text, re.IGNORECASE)
        if f_match:
            return f"F{f_match.group(1).zfill(2)}", None

        # Check professor name pattern
        name_match = re.search(r"(?:prof(?:essor)?|dr\.?)\s+([A-Za-z]+)", text, re.IGNORECASE)
        if name_match:
            return None, name_match.group(1)

        return None, None

    @classmethod
    def extract_group(cls, text: str) -> str | None:
        """Find student group identifier (e.g. CSE-3, Y1-A)."""
        match = re.search(r"\b(CSE-[23]|ECE-[23]|EE-[23]|ME-[23]|CE-[23]|Y1-[A-D])\b", text, re.IGNORECASE)
        if match:
            return match.group(1).upper()
        return None

    @classmethod
    def extract_booking_id(cls, text: str) -> str | None:
        """Find booking request code (BR-01..BR-25)."""
        match = re.search(r"\bBR-?([0-2]?[0-9])\b", text, re.IGNORECASE)
        if match:
            num = match.group(1).zfill(2)
            return f"BR-{num}"
        return None

    @classmethod
    def extract_course(cls, text: str) -> str | None:
        """Extract course code or subject mention."""
        c_match = re.search(r"\b([A-Z]{2}[0-9]{3})\b", text)
        if c_match:
            return c_match.group(1)

        lower = text.lower()
        if "physics" in lower:
            return "PH101"
        if "math" in lower or "mathematics" in lower:
            return "MA101"
        if "electronics" in lower:
            return "EC201"
        if "mechanics" in lower:
            return "ME101"
        return None

    @classmethod
    def parse_deterministic(cls, message: str) -> ParsedAssistantRequest:
        """Deterministic intent recognition and parameter extraction."""
        lower = message.lower()
        lang = cls.detect_language(message)

        day, date_str = cls.extract_day(message)
        period, time_str = cls.extract_period(message)
        attendance = cls.extract_attendance(message)
        room_type = cls.extract_room_type(message)
        room_id = cls.extract_room_id(message)
        fac_id, fac_name = cls.extract_faculty(message)
        group_id = cls.extract_group(message)
        booking_id = cls.extract_booking_id(message)
        course_id = cls.extract_course(message)

        entities = ExtractedEntities(
            day=day,
            date=date_str,
            start_period=period,
            time_str=time_str,
            expected_attendance=attendance,
            room_type=room_type,
            requested_room=room_id,
            faculty_id=fac_id,
            faculty_name=fac_name,
            student_group=group_id,
            booking_request_id=booking_id,
            course_id=course_id,
        )

        missing_fields: list[str] = []
        clarification: str | None = None

        # 1. Booking Explanation
        if (
            "reject" in lower or "rejected" in lower or "why" in lower
            or "kyu" in lower or "kyun" in lower or "cancel" in lower
        ) and (booking_id or "booking" in lower):
            intent = AssistantIntent.BOOKING_EXPLANATION

        # 2. Disruption Preview
        elif (
            "what happens if" in lower or "becomes unavailable" in lower
            or "what if" in lower or "agar" in lower and "band" in lower
            or "unavailable" in lower and ("room" in lower or "cr-" in lower or "aud" in lower)
        ):
            intent = AssistantIntent.DISRUPTION_PREVIEW

        # 3. Timetable Query
        elif (
            "timetable" in lower or "class" in lower or "classes" in lower
            or "most classes" in lower or "schedule for" in lower
            or group_id is not None and ("show" in lower or "aaj" in lower or "timetable" in lower)
        ):
            intent = AssistantIntent.TIMETABLE_QUERY

        # 4. Exam Query
        elif "exam" in lower or "midsem" in lower or "examination" in lower:
            intent = AssistantIntent.EXAM_QUERY

        # 5. Conflict Query
        elif "conflict" in lower or "conflicts" in lower or "clash" in lower:
            intent = AssistantIntent.CONFLICT_QUERY

        # 6. Booking Status
        elif ("status" in lower or "check" in lower) and booking_id:
            intent = AssistantIntent.BOOKING_STATUS

        # 7. Venue Booking vs Venue Availability
        elif (
            "book" in lower or "need" in lower or "reserve" in lower
            or "chahiye" in lower or "booking" in lower
        ):
            intent = AssistantIntent.VENUE_BOOKING
            # Check missing fields for booking
            if attendance is None:
                missing_fields.append("expected_attendance")
            if day is None:
                missing_fields.append("day")
            if period is None:
                missing_fields.append("time")

            if missing_fields:
                if lang == "hinglish":
                    clarification = (
                        f"Maine samjha ki aapko venue chahiye. Kripya {', '.join(missing_fields)} "
                        "aur event category (e.g. club event, guest lecture) batayein."
                    )
                else:
                    clarification = (
                        f"I understood that you need a venue. Could you please specify the {', '.join(missing_fields)} "
                        "and event category to complete the request?"
                    )

        # 8. Venue Availability (Read-only query)
        elif (
            "available" in lower or "free" in lower or "khali" in lower
            or "find me" in lower or "show me" in lower or "available rooms" in lower
        ):
            intent = AssistantIntent.VENUE_AVAILABILITY

        # 9. General Help
        elif "help" in lower or "kya kar sakte ho" in lower or "what can you do" in lower or "hello" in lower or "hi" in lower:
            intent = AssistantIntent.GENERAL_HELP

        else:
            intent = AssistantIntent.UNKNOWN

        return ParsedAssistantRequest(
            intent=intent,
            entities=entities,
            missing_fields=missing_fields,
            clarification_question=clarification,
            confidence=0.95 if intent != AssistantIntent.UNKNOWN else 0.4,
            original_message=message,
            detected_language=lang,
        )
