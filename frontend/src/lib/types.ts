/**
 * TypeScript types mirroring the backend Pydantic models in app/models/dataset.py.
 * These types are generated to exactly match what the FastAPI endpoints return.
 */

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export interface Period {
  id: number;
  start: string;
  end: string;
  teaching: boolean;
}

export interface ExamSession {
  id: string; // "AM" | "PM"
  start: string;
  end: string;
}

export interface ExamWeek {
  days: string[];
  sessions: ExamSession[];
}

export interface Lunch {
  after_period: number;
  start: string;
  end: string;
}

export interface Calendar {
  days: string[];
  periods: Period[];
  lunch: Lunch;
  lab_start_periods: number[];
  event_only_periods: number[];
  fest_week: string;
  exam_week: ExamWeek;
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export type RoomType =
  | "classroom"
  | "lecture_hall"
  | "auditorium"
  | "seminar_hall"
  | "outdoor"
  | "lab_cs"
  | "lab_elec"
  | "lab_phy"
  | "workshop"
  | "lab_civil";

export type AllowedUse = "lecture" | "tutorial" | "lab" | "exam" | "event";

export interface Room {
  id: string;
  name: string;
  building: string;
  type: RoomType;
  capacity: number;
  features: string[];
  accessible: boolean;
  allowed_uses: AllowedUse[];
}

export interface RoomUnavailability {
  room_id: string;
  day: string;
  periods: number[];
  reason: string;
}

// ---------------------------------------------------------------------------
// Faculty
// ---------------------------------------------------------------------------

export interface FacultyPreference {
  type: string;
  days: string[];
  periods: number[];
  note: string;
}

export interface FacultyUnavailableSlot {
  day: string;
  periods: number[];
}

export interface Faculty {
  id: string;
  name: string;
  department: string;
  max_hours_per_day: number;
  needs_accessible: boolean;
  unavailable: FacultyUnavailableSlot[];
  preferences: FacultyPreference[];
}

// ---------------------------------------------------------------------------
// Student Groups
// ---------------------------------------------------------------------------

export interface StudentGroup {
  id: string;
  name: string;
  year: number;
  department: string;
  size: number;
  needs_accessible: boolean;
}

// ---------------------------------------------------------------------------
// Courses
// Note: JSON uses "title" (not "name") and includes a "year" field.
// ---------------------------------------------------------------------------

export interface Course {
  id: string;
  title: string;
  department: string;
  year: number;
  lecture_hours: number;
  tutorial_hours: number;
  lab_blocks: number;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type SessionKind = "lecture" | "tutorial" | "lab";

export interface FixedSlot {
  day: string;
  start_period: number;
}

export interface Session {
  id: string;
  course_id: string;
  kind: SessionKind;
  groups: string[];
  faculty_id: string;
  size: number;
  duration: number;
  room_types: string[];
  needs_accessible: boolean;
  basket_slot: string | null;
  fixed_slot: FixedSlot | null;
}

// ---------------------------------------------------------------------------
// Booking Requests
// ---------------------------------------------------------------------------

export interface BookingWindow {
  day: string;
  from_period: number;
  to_period: number;
}

export interface BookingRequest {
  id: string;
  submitted_at: string;
  requester: string;
  role: string;
  requested_category: string;
  title: string;
  attendance: number;
  duration_periods: number;
  windows: BookingWindow[];
  room_types: string[];
  needs: string[];
  requested_room: string | null;
  mandatory_for_groups: string[];
  series_id: string | null;
  raw_text: string;
}

// ---------------------------------------------------------------------------
// Cancellations
// ---------------------------------------------------------------------------

export interface Cancellation {
  request_id: string;
  cancelled_at: string;
  by: string;
  note: string;
}

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------

export interface Exam {
  id: string;
  course_ids: string[];
  groups: string[];
  size: number;
  duration_hours: number;
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface DatasetSummary {
  dataset_id: string;
  institute: string;
  total_rooms: number;
  total_faculty: number;
  total_student_groups: number;
  total_courses: number;
  total_sessions: number;
  total_booking_requests: number;
  total_cancellations: number;
  total_exams: number;
  total_room_unavailability: number;
}

export interface DatasetMeta {
  dataset_id: string;
  institute: string;
  counts: {
    rooms: number;
    faculty: number;
    student_groups: number;
    courses: number;
    sessions: number;
    booking_requests: number;
    cancellations: number;
    exams: number;
    room_unavailability: number;
  };
}


// ---------------------------------------------------------------------------
// Timetable Generation & Validation
// ---------------------------------------------------------------------------

export interface TimetableSessionAssignment {
  session_id: string;
  day: string;
  start_period: number;
  room_id: string;
}

export interface TimetableSchedule {
  team: string;
  dataset_id: string;
  sessions: TimetableSessionAssignment[];
}

export interface TimetableSolverMetadata {
  solver_status: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN";
  solve_time_seconds: number;
  scheduled_sessions: number;
  total_sessions: number;
  hard_violation_count: number;
  soft_penalty: number;
  objective_value?: number | null;
  hard_by_rule?: Record<string, number>;
  soft_penalties?: Record<string, number>;
}

export interface TimetableResponse {
  schedule: TimetableSchedule;
  metadata: TimetableSolverMetadata;
  violations: Array<Record<string, unknown>>;
}

export interface TimetableValidationResponse {
  is_valid: boolean;
  hard_violation_count: number;
  hard_violations: Array<Record<string, unknown>>;
  soft_penalty: number;
  soft_penalties: Record<string, number>;
}


// ---------------------------------------------------------------------------
// Examination Generation & Validation (Milestone 03)
// ---------------------------------------------------------------------------

export interface ExamAssignmentItem {
  exam_id: string;
  day: string;
  session: "AM" | "PM";
  rooms: string[];
  course_ids: string[];
  groups: string[];
  size: number;
  effective_capacity: number;
}

export interface ExamSchedule {
  team: string;
  dataset_id: string;
  exams: ExamAssignmentItem[];
}

export interface ExamSolverMetadata {
  solver_status: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN";
  solve_time_seconds: number;
  total_exams: number;
  scheduled_exams: number;
  hard_violation_count: number;
  soft_penalty: number;
  objective_value?: number | null;
  hard_by_rule?: Record<string, number>;
  rooms_used_count: number;
  total_capacity_provided: number;
  total_students_seated: number;
}

export interface GenerateExamRequest {
  team_name?: string;
  time_limit_seconds?: number;
  num_workers?: number;
  optimize_soft?: boolean;
}

export interface ExamResponse {
  schedule: ExamSchedule;
  metadata: ExamSolverMetadata;
  violations: Array<Record<string, unknown>>;
}

export interface ExamValidationResponse {
  is_valid: boolean;
  hard_violation_count: number;
  hard_violations: Array<Record<string, unknown>>;
  soft_penalty: number;
}


// ---------------------------------------------------------------------------
// Spectra Week Venue Bookings (Milestone 04)
// ---------------------------------------------------------------------------

export type BookingStatus = "approved" | "rejected" | "alternative_offered";

export interface BookingDecision {
  request_id: string;
  status: BookingStatus;
  day?: string | null;
  start_period?: number | null;
  end_period?: number | null;
  room_id?: string | null;
  reason: string;
}

export interface SessionOverride {
  session_id: string;
  day: string;
  start_period: number;
  room_id: string;
  displaced_by: string;
}

export interface FestWeekSchedule {
  bookings: BookingDecision[];
  session_overrides: SessionOverride[];
}

export interface BookingRequestItem {
  id: string;
  submitted_at: string;
  requester: string;
  role: string;
  department?: string | null;
  requested_category: string;
  effective_category: string;
  title: string;
  attendance: number;
  duration_periods: number;
  windows: Array<{
    day: string;
    from_period: number;
    to_period: number;
  }>;
  room_types: string[];
  needs: string[];
  requested_room?: string | null;
  mandatory_for_groups: string[];
  series_id?: string | null;
  raw_text: string;
  is_cancelled: boolean;
  cancellation_note?: string | null;
  decision?: BookingDecision | null;
}

export interface BookingValidationReport {
  is_valid: boolean;
  hard_violation_count: number;
  hard_violations: Array<Record<string, unknown>>;
  warnings: string[];
  booking_score: number;
  booking_score_max: number;
  approved_count: number;
  rejected_count: number;
  alternative_count: number;
  session_overrides_count: number;
  priority_inversions: string[];
}

export interface SlotOption {
  day: string;
  start_period: number;
  end_period: number;
  room_id: string;
  is_inside_window: boolean;
  is_requested_room: boolean;
}

export interface EvaluateBookingResponse {
  effective_category: string;
  role_cap: string;
  is_feasible: boolean;
  compatible_rooms: string[];
  available_slots_inside_windows: SlotOption[];
  suggested_alternative?: SlotOption | null;
  conflicts: string[];
  recommendation: BookingDecision;
}

export interface EvaluateBookingRequest {
  request_id?: string | null;
  role: string;
  requested_category: string;
  attendance: number;
  duration_periods: number;
  windows: Array<{
    day: string;
    from_period: number;
    to_period: number;
  }>;
  room_types: string[];
  needs: string[];
  requested_room?: string | null;
  mandatory_for_groups: string[];
}

export interface ManualDecisionRequest {
  status: BookingStatus;
  day?: string | null;
  start_period?: number | null;
  end_period?: number | null;
  room_id?: string | null;
  reason: string;
}

// ---------------------------------------------------------------------------
// Milestone 05: Rescheduling & Disruption Management Types
// ---------------------------------------------------------------------------

export type DisruptionCategory =
  | "ROOM_UNAVAILABLE"
  | "FACULTY_UNAVAILABLE"
  | "ROOM_MAINTENANCE"
  | "EXAM_ROOM_UNAVAILABLE"
  | "MULTIPLE_RESOURCE_DISRUPTION"
  | "EVENT_PRIORITY_CONFLICT";

export type DisruptionSeverityLevel = "low" | "medium" | "high" | "critical";

export interface DisruptionItemInput {
  disruption_type: DisruptionCategory;
  resource_id: string;
  affected_days: string[];
  start_period: number;
  end_period: number;
  reason: string;
}

export interface DisruptionRequestPayload {
  disruption_id: string;
  disruption_type: DisruptionCategory;
  resource_id: string;
  affected_day?: string | null;
  affected_days: string[];
  start_period?: number | null;
  end_period?: number | null;
  reason: string;
  reported_by: string;
  severity: DisruptionSeverityLevel;
  created_at?: string;
  additional_items?: DisruptionItemInput[];
}

export interface AffectedActivityItem {
  activity_type: "session" | "exam" | "booking";
  activity_id: string;
  course_or_title: string;
  current_day: string;
  current_start_period: number | string;
  current_duration: number;
  current_rooms: string[];
  faculty_id?: string | null;
  student_groups: string[];
  impact_nature: string;
}

export interface ImpactReportData {
  disruption_id: string;
  disruption_type: string;
  reported_by: string;
  affected_days: string[];
  directly_affected_activities: AffectedActivityItem[];
  indirectly_affected_activities: AffectedActivityItem[];
  affected_rooms: string[];
  affected_faculty: string[];
  affected_student_groups: string[];
  affected_dates_and_periods: string[];
  total_activities_requiring_repair: number;
  diagnostic_summary: string;
}

export interface SessionChangeDiff {
  session_id: string;
  course_id: string;
  faculty_id: string;
  groups: string[];
  original_day: string;
  original_start_period: number;
  original_room_id: string;
  proposed_day: string;
  proposed_start_period: number;
  proposed_room_id: string;
  change_type: "room_only" | "time_and_room" | "time_only" | "unchanged";
  reason: string;
}

export interface ExamChangeDiff {
  exam_id: string;
  course_id: string;
  original_day: string;
  original_session: string;
  original_rooms: string[];
  proposed_day: string;
  proposed_session: string;
  proposed_rooms: string[];
  change_type: string;
  reason: string;
}

export interface BookingChangeDiff {
  request_id: string;
  event_name: string;
  original_status: string;
  original_room_id?: string | null;
  original_day?: string | null;
  original_start_period?: number | null;
  proposed_status: string;
  proposed_room_id?: string | null;
  proposed_day?: string | null;
  proposed_start_period?: number | null;
  reason: string;
}

export interface ReschedulingValidationReportData {
  is_valid: boolean;
  hard_violation_count: number;
  hard_violations: Array<{ rule: string; where: string; detail: string }>;
  soft_penalty: number;
  soft_penalties: Record<string, number>;
  exam_soft_penalty: number;
  booking_score: number;
  booking_inversions: number;
  sessions_moved: number;
  time_changed: number;
  room_only_changed: number;
}

export interface RepairProposalData {
  proposal_id: string;
  disruption_id: string;
  baseline_schedule_id: string;
  baseline_hash: string;
  status: "pending" | "approved" | "rejected" | "stale";
  solver_status: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN";
  is_feasible: boolean;
  solve_time_seconds: number;
  created_at: string;
  created_by: string;
  approved_by?: string | null;
  decided_at?: string | null;
  decision_reason?: string | null;
  changed_sessions: SessionChangeDiff[];
  changed_exams: ExamChangeDiff[];
  changed_bookings: BookingChangeDiff[];
  unresolved_activities: string[];
  validation_report: ReschedulingValidationReportData;
  proposed_schedule: Record<string, unknown>;
}

export interface ProposalDecisionPayload {
  decided_by: string;
  reason: string;
}

export interface ScheduleVersionAuditRecord {
  version_id: string;
  version_number: number;
  disruption_id: string;
  proposal_id: string;
  approved_by: string;
  timestamp: string;
  sessions_moved_count: number;
  hard_violation_count: number;
  soft_penalty: number;
  backup_file_path: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Milestone 06: AI Assistant & Natural Language Types
// ---------------------------------------------------------------------------

export interface AssistantChatRequestPayload {
  message: string;
  conversation_id?: string | null;
  language?: string | null;
  user_role: string;
  user_id?: string | null;
}

export interface AssistantChatResponseData {
  conversation_id: string;
  message: string;
  intent: string;
  extracted_entities: Record<string, unknown>;
  requires_clarification: boolean;
  clarification_question?: string | null;
  action_result?: Record<string, unknown> | null;
  references: Array<{ type: string; id: string }>;
  suggested_actions: string[];
}

export interface AssistantHealthData {
  status: string;
  provider: string;
  model: string;
  supported_languages: string[];
  deterministic_guarantee: boolean;
  capabilities: string[];
}

// ---------------------------------------------------------------------------
// Authentication & Judge Demo Accounts
// ---------------------------------------------------------------------------

export type UserRole =
  | "admin"
  | "department_coordinator"
  | "faculty"
  | "club_representative";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department: string | null;
  club: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface DemoAccountPublicInfo {
  email: string;
  full_name: string;
  role: UserRole;
  department: string | null;
  club: string | null;
  dashboard_scope: string;
}





