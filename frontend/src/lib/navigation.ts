/**
 * Centralized Role-Based Navigation Configuration for CIT Campus OS.
 *
 * Implements strict role-tailored navigation hierarchies for:
 * - Admin: Full campus management, solvers, global bookings, analytics, user management, and system settings.
 * - Department Coordinator: CSE department timetable, faculty & student groups, department bookings, lab approvals.
 * - Faculty: Personal teaching schedule, 4h daily availability, session change requests, guest lecture bookings.
 * - Club Representative: Spectra festival dashboard, new venue request submission, my bookings, decisions status.
 */

import type { User, UserRole } from "./types";

export type NavTabId =
  | "overview"
  | "timetable"
  | "examinations"
  | "venues"
  | "rescheduling"
  | "ai"
  | "analytics"
  | "settings"
  | "users"
  | "faculty_groups"
  | "availability"
  | "venue_request"
  | "booking_status";

export interface NavItem {
  id: NavTabId;
  label: string;
  badge?: string;
  description?: string;
}

/** Admin Navigation: System-wide authority */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", badge: "Central", description: "Campus-wide scheduling KPIs & system status" },
  { id: "timetable", label: "Timetable Management", badge: "CP-SAT", description: "Regular 189-session timetable generation & room grid" },
  { id: "examinations", label: "Examination Management", badge: "50% Cap", description: "Midsem examination hall allocations & clash check" },
  { id: "venues", label: "Venue Bookings", badge: "Spectra", description: "Priority event allocation, approvals & manual overrides" },
  { id: "rescheduling", label: "Rescheduling & Approvals", badge: "Repair", description: "Room/faculty disruption repairs & atomic commits" },
  { id: "ai", label: "AI Assistant", badge: "NLP", description: "Bilingual English & Hinglish scheduling copilot" },
  { id: "analytics", label: "Analytics & Reports", badge: "KPI", description: "Room utilization, faculty teaching load & metrics" },
  { id: "settings", label: "System Settings", badge: "Config", description: "Booking priority queue, dataset registry & demo reset" },
  { id: "users", label: "User Management", badge: "RBAC", description: "Judge demo accounts, sessions & permission scopes" },
];

/** Department Coordinator Navigation: Restricted to Department (CSE) */
export const COORDINATOR_NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", badge: "CSE", description: "Departmental scheduling overview & session distribution" },
  { id: "timetable", label: "Department Timetable", badge: "CSE-1-3", description: "Filtered timetable for CSE student groups & synchronized labs" },
  { id: "faculty_groups", label: "Faculty & Groups", badge: "Faculty", description: "CSE faculty teaching hours, workloads & student groups" },
  { id: "venues", label: "Department Bookings", badge: "Dept", description: "Departmental seminars, workshops & lab bookings" },
  { id: "rescheduling", label: "Lab Booking Approvals", badge: "Approvals", description: "Lab venue requests & disruption shift approvals" },
  { id: "ai", label: "AI Assistant", badge: "NLP", description: "Query room availability, clashes & department schedules" },
  { id: "settings", label: "My Profile", badge: "CSE Coord", description: "Department coordinator profile & account preferences" },
];

/** Faculty Navigation: Restricted to Teaching Load and Personal Requests */
export const FACULTY_NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "My Dashboard", badge: "Teaching", description: "Today's classes, weekly teaching hours & upcoming sessions" },
  { id: "timetable", label: "My Timetable", badge: "Schedule", description: "Personal lecture & synchronized lab timetable" },
  { id: "availability", label: "My Availability", badge: "4h Max", description: "Daily max hours cap (4 hrs) & teaching period preferences" },
  { id: "rescheduling", label: "Session Change Requests", badge: "Requests", description: "Submit emergency leaves or class displacement requests" },
  { id: "venues", label: "Guest Lecture Requests", badge: "Seminars", description: "Request seminar hall bookings for guest lectures" },
  { id: "ai", label: "AI Assistant", badge: "NLP", description: "Check room availability & teaching schedule in natural language" },
  { id: "settings", label: "My Profile", badge: "Faculty", description: "Faculty profile, CSE department & credentials" },
];

/** Club Representative Navigation: Strictly restricted to Club Bookings (Spectra) */
export const CLUB_NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "My Dashboard", badge: "Spectra", description: "Spectra festival countdown, quota usage (3-event cap) & status" },
  { id: "venue_request", label: "New Venue Request", badge: "Submit", description: "Evaluate and submit new festival venue booking requests" },
  { id: "venues", label: "My Bookings", badge: "3 Cap", description: "Approved and pending booking requests for Spectra Festival" },
  { id: "booking_status", label: "Booking Status & Decisions", badge: "Decisions", description: "Allocations, displacement notifications & official rule reasons" },
  { id: "settings", label: "My Profile", badge: "Spectra", description: "Club representative profile & festival lead details" },
];

/** Unauthenticated Guest Navigation */
export const GUEST_NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", badge: "Public" },
  { id: "timetable", label: "Timetable Preview", badge: "Read-Only" },
  { id: "ai", label: "AI Assistant", badge: "Demo" },
];

/**
 * Retrieve the authorized navigation items strictly based on the backend-authenticated user's role.
 */
export function getNavItemsForRole(role: UserRole | null | undefined): NavItem[] {
  if (!role) return GUEST_NAV_ITEMS;
  switch (role) {
    case "admin":
      return ADMIN_NAV_ITEMS;
    case "department_coordinator":
      return COORDINATOR_NAV_ITEMS;
    case "faculty":
      return FACULTY_NAV_ITEMS;
    case "club_representative":
      return CLUB_NAV_ITEMS;
    default:
      return GUEST_NAV_ITEMS;
  }
}

/**
 * Deterministically check whether a tab is authorized for the given role.
 */
export function isTabAuthorizedForRole(tabId: NavTabId, role: UserRole | null | undefined): boolean {
  if (!role) {
    return GUEST_NAV_ITEMS.some((item) => item.id === tabId);
  }
  const items = getNavItemsForRole(role);
  return items.some((item) => item.id === tabId);
}

/**
 * Get the initial landing tab for a role.
 */
export function getDefaultTabForRole(role: UserRole | null | undefined): NavTabId {
  return "overview";
}

/**
 * Return friendly workspace title for top navigation.
 */
export function getRoleWorkspaceTitle(user: User | null): string {
  if (!user) return "Campus Administration Dashboard";
  switch (user.role) {
    case "admin":
      return "Campus Administration Dashboard";
    case "department_coordinator":
      return `${user.department || "CSE"} Department Coordinator Portal`;
    case "faculty":
      return "Faculty Teaching & Scheduling Portal";
    case "club_representative":
      return `${user.club || "Spectra"} Club & Event Portal`;
    default:
      return "Campus Administration Dashboard";
  }
}

