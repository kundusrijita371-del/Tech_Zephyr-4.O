# AI Usage & Natural Language Architecture

## 1. Overview & Core Philosophy

The **CIT Campus Scheduling and Venue Management System** utilizes artificial intelligence exclusively as a **conversational natural language interface (copilot)**. The AI interprets user intent and extracts parameters, but **never makes scheduling decisions, approves bookings, overrides role caps, or validates constraints**.

All allocations, conflict detections, and timetable repairs remain **100% deterministic**, mathematically verified by Google OR-Tools CP-SAT and the official CrunchWeek `validator.py`.

---

## 2. AI Provider & Models

- **Primary Provider**: Google Gemini API (`generativelanguage.googleapis.com`)
- **Default Model**: `gemini-2.0-flash` (with `temperature: 0.1` and `response_mime_type: "application/json"`)
- **Fallback Engine**: In-memory rule-based deterministic parser (`IntentService`)
- **Languages Supported**: Standard English and bilingual Hinglish (Hindi-English colloquial mix)

---

## 3. Strict Task Boundary Matrix

| System Task | Technology / Engine | Deterministic Guarantee |
| :--- | :--- | :--- |
| **Conversational Understanding** | Google Gemini 2.0 Flash | Structured JSON validated via Pydantic schemas |
| **Hinglish & English Fallback Parsing** | Deterministic Regex & Keyword Matcher | 100% Deterministic (Works offline without API key) |
| **Regular Timetable Scheduling** | Google OR-Tools CP-SAT | 100% Deterministic (Zero hard violations H1–H14) |
| **Midsem Examination Allocation** | Google OR-Tools CP-SAT | 100% Deterministic (Strict 50% capacity partitioning) |
| **Spectra Week Event Bookings** | Priority Queue Allocator & Matcher | 100% Deterministic (Role caps & tie-breaking) |
| **Disruption Blast Radius Simulation** | Impact Analyzer & CP-SAT Repair Solver | 100% Deterministic (Minimal change stability objective) |
| **Schedule Approval & Commit** | Administrator Two-Stage Workflow | Authorized Admin identity required |
| **Final Compliance Verification** | Untouched Official `validator.py` | Official judge benchmark (0 hard violations) |

---

## 4. What the AI is Strictly Forbidden to Do

1. **Never directly approve or reject bookings**: The AI routes all venue requests through `BookingService.evaluate_request` and marks them for human administrator approval.
2. **Never hallucinate room availability or timetable data**: The AI executes queries against live in-memory schedules and the official `cit_public.json` dataset.
3. **Never override priority rules or role caps**: Role permissions (Admin, Faculty, Department Coordinator, Club) are verified server-side.
4. **Never decide whether a schedule is valid**: Schedule validity is solely determined by `validator.py`.
5. **Never automatically commit disruption repairs**: Disruption plans remain in `pending` preview until approved by an authorized administrator.

---

## 5. Offline & Fallback Architecture

If the `GEMINI_API_KEY` environment variable is not provided, or if the external API call encounters network failure or latency exceeding `AI_TIMEOUT_SECONDS`:
- The backend automatically invokes `IntentService.parse_deterministic`.
- The assistant continues answering all English and Hinglish queries seamlessly.
- All automated unit tests in `tests/test_assistant.py` execute offline with 100% determinism.

---

## 6. Known Limitations

- The assistant operates in academic session time context (MON–SAT teaching periods P1–P9, and evening fest periods P10–P13).
- Free-form multi-day workshop requests require explicit day specifications or user clarification.
- Admin-level actions requested via chat (such as schedule commits) provide guidance links to the respective administrative panels rather than executing inline.

