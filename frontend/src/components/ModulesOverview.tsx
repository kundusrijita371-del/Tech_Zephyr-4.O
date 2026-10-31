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
  {
    id: "settings",
    title: "Settings & Administration",
    milestone: "Administration",
    status: "active",
    description:
      "Enterprise management: 6-stage booking priority queue reordering, official validator inspector across 4 domains, dataset uploader, and benchmark demo reset.",
    capabilities: [
      "Role-based access control (Admin, Coord, Faculty, Club)",
      "Interactive 6-stage booking priority manager",
      "Official validator inspector & demo reset",
    ],
  },
];

export function ModulesOverview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#F4F2FA] tracking-tight">
            CIT Platform Modules Overview
          </h2>
          <p className="text-xs text-[#71717A]">
            Production roadmap and active status across all core campus management systems
          </p>
        </div>
        <span className="hidden sm:inline-flex rounded-full bg-[#19191F] border border-[#30303A] px-3 py-1 text-xs font-medium text-[#A1A1AA]">
          7 Modules Operational
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((mod) => (
          <div
            key={mod.id}
            className="flex flex-col justify-between rounded-2xl border border-[#30303A] bg-[#202027] p-5 shadow-xs transition-all hover:border-[#8B5CF6]/50 hover:shadow-lg hover:shadow-black/20"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-[#A78BFA] uppercase tracking-wide">
                  {mod.milestone}
                </span>
                {mod.status === "active" ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-0.5 text-[11px] font-semibold text-[#34D399]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
                    Active
                  </span>
                ) : mod.status === "next" ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-blue-950/60 border border-blue-800/40 px-2.5 py-0.5 text-[11px] font-semibold text-blue-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    Up Next
                  </span>
                ) : (
                  <span className="rounded-full bg-[#292933] border border-[#30303A] px-2.5 py-0.5 text-[11px] font-medium text-[#71717A]">
                    Planned
                  </span>
                )}
              </div>

              <h3 className="mt-2 text-sm font-bold text-[#F4F2FA] tracking-tight">
                {mod.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#A1A1AA]">
                {mod.description}
              </p>
            </div>

            <div className="mt-4 border-t border-[#30303A] pt-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] mb-2">
                Key Capabilities
              </div>
              <ul className="space-y-1">
                {mod.capabilities.map((cap, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-[11px] text-[#A1A1AA]"
                  >
                    <svg
                      className="h-3 w-3 shrink-0 text-[#34D399]"
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
