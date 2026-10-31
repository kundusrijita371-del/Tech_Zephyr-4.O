/**
 * Typed API client for the CIT Campus Management backend.
 *
 * All functions return typed responses from the FastAPI backend running at
 * NEXT_PUBLIC_API_URL (default: http://localhost:8000).
 */

import type {
  BookingRequest,
  Calendar,
  Course,
  DatasetMeta,
  DatasetSummary,
  Exam,
  Faculty,
  Room,
  Session,
  StudentGroup,
  DisruptionRequestPayload,
  ImpactReportData,
  RepairProposalData,
  ProposalDecisionPayload,
  ScheduleVersionAuditRecord,
  AssistantChatRequestPayload,
  AssistantChatResponseData,
  AssistantHealthData,
} from "./types";

// Base URL is injected at build time from the environment variable.
// Falls back to localhost:8000 for local development.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

const V1 = `${API_BASE}/api/v1`;

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${V1}${path}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `CIT API error: ${res.status} ${res.statusText} — GET ${path}`
    );
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/** Ping the backend health endpoint. */
export async function checkHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<{ status: string }>;
}

// ---------------------------------------------------------------------------
// Dataset endpoints
// ---------------------------------------------------------------------------

/** Dataset summary with entity counts. */
export const getDatasetSummary = (): Promise<DatasetSummary> =>
  get<DatasetSummary>("/dataset/summary");

/** Dataset metadata and entity counts (alias). */
export const getDatasetMeta = (): Promise<DatasetMeta> =>
  get<DatasetMeta>("/dataset/meta");

/** Calendar configuration (days, periods, exam week, etc.). */
export const getCalendar = (): Promise<Calendar> =>
  get<Calendar>("/dataset/calendar");

/** All 27 rooms. */
export const listRooms = (): Promise<Room[]> => get<Room[]>("/dataset/rooms");

/** Single room by ID. Throws on 404. */
export const getRoom = (roomId: string): Promise<Room> =>
  get<Room>(`/dataset/rooms/${encodeURIComponent(roomId)}`);

/** All 40 faculty members. */
export const listFaculty = (): Promise<Faculty[]> =>
  get<Faculty[]>("/dataset/faculty");

/** Single faculty member by ID. Throws on 404. */
export const getFaculty = (facultyId: string): Promise<Faculty> =>
  get<Faculty>(`/dataset/faculty/${encodeURIComponent(facultyId)}`);

/** All 14 student groups. */
export const listGroups = (): Promise<StudentGroup[]> =>
  get<StudentGroup[]>("/dataset/groups");

/** Alias for listGroups. */
export const listStudentGroups = (): Promise<StudentGroup[]> =>
  get<StudentGroup[]>("/dataset/groups");

/** All 62 courses. */
export const listCourses = (): Promise<Course[]> =>
  get<Course[]>("/dataset/courses");

/** All 189 sessions to schedule. */
export const listSessions = (): Promise<Session[]> =>
  get<Session[]>("/dataset/sessions");

/** Single session by ID. Throws on 404. */
export const getSession = (sessionId: string): Promise<Session> =>
  get<Session>(`/dataset/sessions/${encodeURIComponent(sessionId)}`);

/** All 25 fest-week booking requests. */
export const listBookingRequests = (): Promise<BookingRequest[]> =>
  get<BookingRequest[]>("/dataset/booking-requests");

/** All 41 exam definitions. */
export const listExams = (): Promise<Exam[]> =>
  get<Exam[]>("/dataset/exams");


// ---------------------------------------------------------------------------
// Timetable endpoints (Milestone 02)
// ---------------------------------------------------------------------------

import type {
  BookingRequestItem,
  BookingValidationReport,
  EvaluateBookingRequest,
  EvaluateBookingResponse,
  ExamResponse,
  ExamValidationResponse,
  GenerateExamRequest,
  ManualDecisionRequest,
  TimetableResponse,
  TimetableValidationResponse,
} from "./types";

/** Generate a complete clash-free timetable using Google OR-Tools CP-SAT. */
export async function generateTimetable(options?: {
  team_name?: string;
  time_limit_seconds?: number;
  num_workers?: number;
  optimize_soft?: boolean;
}): Promise<TimetableResponse> {
  const res = await fetch(`${V1}/timetable/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `CIT Timetable Generation Error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<TimetableResponse>;
}

/** Get the latest generated timetable. Throws 404 if none exists. */
export const getLatestTimetable = (): Promise<TimetableResponse> =>
  get<TimetableResponse>("/timetable");

/** Get official validation for the latest generated timetable. */
export const getTimetableValidation = (): Promise<TimetableValidationResponse> =>
  get<TimetableValidationResponse>("/timetable/validation");


// ---------------------------------------------------------------------------
// Examination endpoints (Milestone 03)
// ---------------------------------------------------------------------------

/** Generate a complete clash-free midsem exam schedule using Google OR-Tools CP-SAT. */
export async function generateExams(
  options?: GenerateExamRequest
): Promise<ExamResponse> {
  const res = await fetch(`${V1}/exams/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `CIT Exam Generation Error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<ExamResponse>;
}

/** Get the latest generated examination schedule. Throws 404 if none exists. */
export const getLatestExams = (): Promise<ExamResponse> =>
  get<ExamResponse>("/exams");

/** Get official validation for the latest generated examination schedule. */
export const getExamValidation = (): Promise<ExamValidationResponse> =>
  get<ExamValidationResponse>("/exams/validation");


// ---------------------------------------------------------------------------
// Spectra Week Venue Bookings (Milestone 04)
// ---------------------------------------------------------------------------

/** Get all 25 booking requests combined with their allocated decisions. */
export const listBookings = (): Promise<BookingRequestItem[]> =>
  get<BookingRequestItem[]>("/bookings");

/** Get single booking request by ID with current decision and explanation. */
export const getBooking = (requestId: string): Promise<BookingRequestItem> =>
  get<BookingRequestItem>(`/bookings/${encodeURIComponent(requestId)}`);

/** Run deterministic priority-aware booking allocation for all 25 requests. */
export async function generateBookings(): Promise<BookingValidationReport> {
  const res = await fetch(`${V1}/bookings/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `CIT Booking Allocation Error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<BookingValidationReport>;
}

/** Get official validator.py report for the latest fest_week schedule. */
export const getBookingValidation = (): Promise<BookingValidationReport> =>
  get<BookingValidationReport>("/bookings/validation");

/** Evaluate an editable booking request without persisting decisions. */
export async function evaluateBooking(
  request: EvaluateBookingRequest
): Promise<EvaluateBookingResponse> {
  const res = await fetch(`${V1}/bookings/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `CIT Booking Evaluation Error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<EvaluateBookingResponse>;
}

/** Record or override a decision for a booking request subject to validation. */
export async function recordBookingDecision(
  requestId: string,
  payload: ManualDecisionRequest
): Promise<BookingValidationReport> {
  const res = await fetch(`${V1}/bookings/${encodeURIComponent(requestId)}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.detail || `CIT Manual Decision Error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<BookingValidationReport>;
}

// ---------------------------------------------------------------------------
// Rescheduling & Timetable Repair (Milestone 05)
// ---------------------------------------------------------------------------

/** Submit a disruption request and generate a minimal-change repair preview. */
export async function previewDisruptionRepair(
  payload: DisruptionRequestPayload
): Promise<RepairProposalData> {
  const res = await fetch(`${V1}/rescheduling/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.detail || `CIT Rescheduling Preview Error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<RepairProposalData>;
}

/** Retrieve the impact analysis for a specific disruption ID. */
export const getDisruptionImpact = (disruptionId: string): Promise<ImpactReportData> =>
  get<ImpactReportData>(`/rescheduling/impact/${encodeURIComponent(disruptionId)}`);

/** List all generated repair proposals. */
export const listRepairProposals = (): Promise<RepairProposalData[]> =>
  get<RepairProposalData[]>("/rescheduling/proposals");

/** Get single proposal details with before/after diffs. */
export const getRepairProposal = (proposalId: string): Promise<RepairProposalData> =>
  get<RepairProposalData>(`/rescheduling/proposals/${encodeURIComponent(proposalId)}`);

/** Approve a repair proposal and atomically commit the new schedule version. */
export async function approveRepairProposal(
  proposalId: string,
  decision: ProposalDecisionPayload
): Promise<ScheduleVersionAuditRecord> {
  const res = await fetch(`${V1}/rescheduling/proposals/${encodeURIComponent(proposalId)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(decision),
    cache: "no-store",
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.detail || `CIT Proposal Approval Error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<ScheduleVersionAuditRecord>;
}

/** Reject a repair proposal without changing the active schedule. */
export async function rejectRepairProposal(
  proposalId: string,
  decision: ProposalDecisionPayload
): Promise<RepairProposalData> {
  const res = await fetch(`${V1}/rescheduling/proposals/${encodeURIComponent(proposalId)}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(decision),
    cache: "no-store",
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.detail || `CIT Proposal Rejection Error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<RepairProposalData>;
}

/** Retrieve the historical audit trail of approved schedule versions. */
export const getScheduleVersionHistory = (): Promise<ScheduleVersionAuditRecord[]> =>
  get<ScheduleVersionAuditRecord[]>("/rescheduling/history");

// ---------------------------------------------------------------------------
// AI Assistant & Natural Language Interface (Milestone 06)
// ---------------------------------------------------------------------------

/** Send a natural language query in English or Hinglish to the scheduling assistant. */
export async function sendAssistantChat(
  payload: AssistantChatRequestPayload
): Promise<AssistantChatResponseData> {
  const res = await fetch(`${V1}/assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.detail || `CIT Assistant Chat Error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<AssistantChatResponseData>;
}

/** Check assistant service health, provider status, and active model. */
export const getAssistantHealth = (): Promise<AssistantHealthData> =>
  get<AssistantHealthData>("/assistant/health");




