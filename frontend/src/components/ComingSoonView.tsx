"use client";

import React from "react";
import type { NavTabId } from "./Sidebar";

interface ComingSoonViewProps {
  tabId: NavTabId;
  onBackToOverview: () => void;
}

const TAB_METADATA: Record<
  Exclude<NavTabId, "overview">,
  {
    title: string;
    milestone: string;
    description: string;
    expectedDeliverables: string[];
    technicalStack: string[];
  }
> = {
  timetable: {
    title: "Timetable Scheduling Engine",
    milestone: "Milestone 02",
    description:
      "Automated weekly timetable generation placing all 189 teaching sessions into Mon-Fri teaching periods (P1-P9) across 27 campus rooms.",
    expectedDeliverables: [
      "Zero hard constraint violations against official validator.py",
      "Strict capacity checking and feature matching (projectors, labs, accessibility)",
      "Elective basket parallel synchronization for OE301, OE302, OE303",
      "Faculty daily teaching hours hard limits and soft preference optimization",
    ],
    technicalStack: ["Python", "Google OR-Tools CP-SAT", "Deterministic Solver"],
  },
  examinations: {
    title: "Examination Hall Management",
    milestone: "Milestone 03",
    description:
      "Midsem exam session scheduler managing 41 exams across MON-SAT AM (09:30-11:30) and PM (14:00-16:00) sessions.",
    expectedDeliverables: [
      "Strict halved (50%) seating capacity for exam conditions",
      "Multi-room exam allocation for large cohorts (up to 360 students)",
      "Clash-free student group timetabling",
    ],
    technicalStack: ["FastAPI", "Room Capacity Partitioner", "Exam Matrix"],
  },
  venues: {
    title: "Spectra Fest Week Venue Bookings",
    milestone: "Milestone 04",
    description:
      "Week 7 booking manager evaluating 25 event requests from Admin, Faculty, Department Coordinators, and Student Clubs.",
    expectedDeliverables: [
      "Role-category priority order enforcement (Admin > Faculty > Dept > Club)",
      "Window-fitting constraint checker (duration & time windows)",
      "Automated alternative offerings and rejection rationales",
      "Session override dispatcher for displaced regular classes",
    ],
    technicalStack: ["Priority Queue Engine", "Conflict Resolution", "Displacement Tracker"],
  },
  rescheduling: {
    title: "Disruption & Rescheduling Engine",
    milestone: "Milestone 05",
    description:
      "Handles unexpected campus disruptions like faculty sick leaves and venue maintenance outages by repairing schedules dynamically.",
    expectedDeliverables: [
      "Minimal disruption objective (preserves unaffected sessions)",
      "Delta export generation (schedule_after.json)",
      "Live re-validation against baseline schedule.json",
    ],
    technicalStack: ["Incremental CP-SAT", "Delta Graph Engine", "Validator Integration"],
  },
  ai: {
    title: "AI Natural Language Assistant",
    milestone: "Milestone 06",
    description:
      "Gemini-powered conversational interface for booking venue requests, asking timetable questions, and generating reports.",
    expectedDeliverables: [
      "Extracts structured BookingRequest JSON from plain English messages",
      "Answers questions like 'Which seminar hall is free Thursday 4 PM?'",
      "Never decides schedule validity—all outputs validated deterministically in Python",
    ],
    technicalStack: ["Gemini 2.5 Flash API", "Structured Outputs", "Zero-Hallucination Guardrails"],
  },
  settings: {
    title: "System & Architecture Settings",
    milestone: "Configuration",
    description:
      "Platform configuration, API endpoints, validator parameters, and database sync options.",
    expectedDeliverables: [
      "Backend endpoint selector (Local / Staging / Production)",
      "Dataset reloading and cache invalidation",
      "Validator report inspector",
    ],
    technicalStack: ["Next.js App Config", "FastAPI CORS", "Supabase Ready"],
  },
};

export function ComingSoonView({ tabId, onBackToOverview }: ComingSoonViewProps) {
  if (tabId === "overview") return null;

  const info = TAB_METADATA[tabId];

  return (
    <div className="mx-auto max-w-4xl py-6 space-y-6">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-blue-600 uppercase tracking-wider">
                {info.milestone}
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                In Development Pipeline
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {info.title}
            </h2>
          </div>
          <button
            onClick={onBackToOverview}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            ← Back to Overview
          </button>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-slate-600">
          {info.description}
        </p>

        {/* Expected Deliverables */}
        <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/70 p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Planned Deliverables
          </h3>
          <ul className="mt-3 space-y-2">
            {info.expectedDeliverables.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                  {idx + 1}
                </span>
                <span className="mt-0.5 leading-normal">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Technical Stack Pills */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Tech Stack:</span>
          {info.technicalStack.map((tech, idx) => (
            <span
              key={idx}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

