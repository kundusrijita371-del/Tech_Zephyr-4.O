"use client";

import React from "react";
import type { NavTabId } from "./Sidebar";

interface ComingSoonViewProps {
  tabId: NavTabId;
  onBackToOverview: () => void;
}

const DEFAULT_METADATA = {
  title: "CIT Campus OS Module",
  milestone: "Platform Module",
  description: "Operational management capability within CIT Campus OS.",
  expectedDeliverables: [
    "Role-based permission enforcement",
    "Real-time state synchronization",
    "Official validator compliance",
  ],
  technicalStack: ["FastAPI", "Next.js", "TypeScript"],
};

const TAB_METADATA: Partial<
  Record<
    Exclude<NavTabId, "overview">,
    {
      title: string;
      milestone: string;
      description: string;
      expectedDeliverables: string[];
      technicalStack: string[];
    }
  >
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

  const info = TAB_METADATA[tabId] || DEFAULT_METADATA;

  return (
    <div className="mx-auto max-w-4xl py-6 space-y-6">
      <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30303A] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-[#A78BFA] uppercase tracking-wider">
                {info.milestone}
              </span>
              <span className="rounded-full bg-amber-950/60 border border-amber-800/40 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                In Development Pipeline
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#F4F2FA]">
              {info.title}
            </h2>
          </div>
          <button
            onClick={onBackToOverview}
            className="rounded-lg border border-[#30303A] bg-[#202027] px-4 py-2 text-xs font-semibold text-[#F4F2FA] shadow-xs hover:bg-[#292933] hover:border-[#8B5CF6]/50 transition-colors cursor-pointer"
          >
            ← Back to Overview
          </button>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-[#A1A1AA]">
          {info.description}
        </p>

        {/* Expected Deliverables */}
        <div className="mt-6 rounded-xl border border-[#30303A] bg-[#202027] p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#F4F2FA]">
            Planned Deliverables
          </h3>
          <ul className="mt-3 space-y-2">
            {info.expectedDeliverables.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-[#A1A1AA]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-[#A78BFA] text-[10px] font-bold">
                  {idx + 1}
                </span>
                <span className="mt-0.5 leading-normal">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Technical Stack Pills */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#71717A]">Tech Stack:</span>
          {info.technicalStack.map((tech, idx) => (
            <span
              key={idx}
              className="rounded-md border border-[#30303A] bg-[#202027] px-2.5 py-1 text-xs font-medium text-[#F4F2FA] shadow-2xs"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
