"use client";

import React from "react";

interface ModuleInfo {
  id: string;
  title: string;
  milestone: string;
  status: "active" | "next" | "planned";
  description: string;
  capabilities: string[];
}

const MODULES: ModuleInfo[] = [
  {
    id: "dataset",
    title: "Dataset & Validation Layer",
    milestone: "Milestone 01",
    status: "active",
    description:
      "Dynamically ingests, validates, and serves the official CIT public dataset (cit_public.json) with strict Pydantic schemas.",
    capabilities: [
      "Dynamic JSON schema validation",
      "FastAPI read-only REST endpoints",
      "Type-safe Next.js frontend client",
    ],
  },
  {
    id: "solver",
    title: "Timetable Scheduling Engine",
    milestone: "Milestone 02",
    status: "active",
    description:
      "Deterministic CP-SAT constraint programming solver assigning 189 sessions into 9 teaching periods across 27 rooms with zero hard clashes.",
    capabilities: [
      "Google OR-Tools CP-SAT formulation",
      "Elective basket parallel sync (OE301-303)",
      "Faculty daily max-hour hard constraints",
    ],
  },
  {
    id: "exams",
    title: "Examination Hall Allocator",
    milestone: "Milestone 03",
    status: "active",
    description:
      "Automated seating allocator for 41 midsem exams across MON-SAT AM/PM shifts enforcing strict 50% social-distanced capacity.",
    capabilities: [
      "50% halved venue capacity enforcement",
      "Multi-hall exam split allocator",
      "Student group clash prevention",
    ],
  },
  {
    id: "venues",
    title: "Spectra Fest Venue Manager",
    milestone: "Milestone 04",
    status: "active",
    description:
      "Week 7 booking manager handling 25 campus event requests with strict role-category caps, priority queues, and session overrides.",
    capabilities: [
      "Role-based category priority queue",
      "Auditorium & stage feature matching",
      "Displaced session migration solver",
    ],
  },
  {
    id: "rescheduling",
    title: "Disruption & Rescheduling Engine",
    milestone: "Milestone 05",
    status: "active",
    description:
      "Intelligent timetable repair engine that resolves sudden room closures and faculty emergencies using Google OR-Tools CP-SAT with minimal change and 0 hard clashes.",
    capabilities: [
      "Two-stage preview & atomic commit workflow",
      "Minimal displacement objective function",
      "Version history with audit trail & rollback",
    ],
  },
  {
    id: "ai",
    title: "AI Natural Language Assistant",
    milestone: "Milestone 06",
    status: "active",
    description:
      "Conversational scheduling copilot interpreting English and Hinglish queries, checking availability, explaining rejections, and simulating hypothetical disruptions with deterministic guarantees.",
    capabilities: [
      "Bilingual English & Hinglish intent parsing",
      "Deterministic fallback without API keys",
      "Interactive venue, timetable, and exam queries",
    ],
  },
];

export function ModulesOverview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            CIT Platform Modules Overview
          </h2>
          <p className="text-xs text-slate-500">
            Roadmap and development status across all 6 core campus management systems
          </p>
        </div>
        <span className="hidden sm:inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          6 Modules Registered
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((mod) => (
          <div
            key={mod.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                  {mod.milestone}
                </span>
                {mod.status === "active" ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active (M01)
                  </span>
                ) : mod.status === "next" ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Up Next
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                    Planned
                  </span>
                )}
              </div>

              <h3 className="mt-2 text-sm font-bold text-slate-900 tracking-tight">
                {mod.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {mod.description}
              </p>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">
                Key Capabilities
              </div>
              <ul className="space-y-1">
                {mod.capabilities.map((cap, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-[11px] text-slate-600"
                  >
                    <svg
                      className="h-3 w-3 shrink-0 text-emerald-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

