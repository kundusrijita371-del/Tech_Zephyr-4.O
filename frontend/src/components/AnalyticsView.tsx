"use client";

import React, { useState } from "react";

export function AnalyticsView() {
  const [timeframe, setTimeframe] = useState<"week" | "fest" | "exam">("week");

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#A78BFA]" />
            <h2 className="text-xl font-bold tracking-tight text-[#F4F2FA]">
              Campus Scheduling Analytics & Intelligence
            </h2>
          </div>
          <p className="text-xs text-[#A1A1AA]">
            Capacity utilization, constraint satisfaction benchmarks, and venue demand analytics across CIT campus.
          </p>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-1 rounded-xl border border-[#30303A] bg-[#141419] p-1">
          <button
            onClick={() => setTimeframe("week")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              timeframe === "week"
                ? "bg-[#8B5CF6] text-white shadow-xs"
                : "text-[#A1A1AA] hover:text-[#F4F2FA]"
            }`}
          >
            Academic Timetable
          </button>
          <button
            onClick={() => setTimeframe("fest")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              timeframe === "fest"
                ? "bg-[#8B5CF6] text-white shadow-xs"
                : "text-[#A1A1AA] hover:text-[#F4F2FA]"
            }`}
          >
            Spectra Week 7
          </button>
          <button
            onClick={() => setTimeframe("exam")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              timeframe === "exam"
                ? "bg-[#8B5CF6] text-white shadow-xs"
                : "text-[#A1A1AA] hover:text-[#F4F2FA]"
            }`}
          >
            Midsem Exams
          </button>
        </div>
      </div>

      {/* KPI Highlight Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-5 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
            Constraint Health
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#34D399]">100%</span>
            <span className="text-xs text-[#34D399] font-semibold">0 Clashes</span>
          </div>
          <p className="text-[11px] text-[#A1A1AA]">Verified by validator.py</p>
        </div>

        <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-5 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
            Total Sessions
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#A78BFA]">189</span>
            <span className="text-xs text-[#71717A]">/ 189 Assigned</span>
          </div>
          <p className="text-[11px] text-[#A1A1AA]">Zero unassigned classes</p>
        </div>

        <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-5 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
            Exam Capacity Cap
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#F4F2FA]">50%</span>
            <span className="text-xs text-[#34D399] font-semibold">Compliant</span>
          </div>
          <p className="text-[11px] text-[#A1A1AA]">Social-distanced seating</p>
        </div>

        <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-5 shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">
            Venue Demand Satisfaction
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#FBBF24]">92%</span>
            <span className="text-xs text-[#A1A1AA]">Priority Allocation</span>
          </div>
          <p className="text-[11px] text-[#A1A1AA]">3 pre-emptions resolved</p>
        </div>
      </div>

      {/* Main Charts & Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Venue Type Utilization */}
        <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-[#F4F2FA] flex items-center justify-between">
            <span>Venue Type Utilization Breakdown</span>
            <span className="text-xs font-mono text-[#A78BFA]">MON–FRI Periods 1–9</span>
          </h3>

          <div className="space-y-3 pt-2">
            {[
              { type: "Computer Science Labs (CS Lab 1 & 2)", load: 88, color: "bg-[#8B5CF6]" },
              { type: "Standard Classrooms (CR-101–105)", load: 74, color: "bg-[#38BDF8]" },
              { type: "Lecture Theaters (LH-201 & 202)", load: 82, color: "bg-[#34D399]" },
              { type: "Main Auditorium (Main Aud)", load: 65, color: "bg-[#FBBF24]" },
              { type: "Electronics & Physics Labs", load: 70, color: "bg-[#A78BFA]" },
              { type: "Outdoor Grounds & Courts", load: 45, color: "bg-[#71717A]" },
            ].map((v) => (
              <div key={v.type} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#A1A1AA]">{v.type}</span>
                  <span className="font-bold text-[#F4F2FA]">{v.load}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#141419] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${v.color} transition-all duration-500`}
                    style={{ width: `${v.load}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Soft Objective Penalties Decomposition */}
        <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-[#F4F2FA] flex items-center justify-between">
            <span>CP-SAT Soft Objective Penalties</span>
            <span className="text-xs font-mono text-[#34D399]">Score: 143 (Minimised)</span>
          </h3>

          <div className="space-y-3 pt-2">
            {[
              { rule: "S1: Daily Teaching Load Balance", penalty: 0, status: "Optimal", desc: "No faculty exceeds daily variance" },
              { rule: "S2: Student Lunch Break Protection", penalty: 140, status: "Minimised", desc: "Guaranteed lunch break after period 4" },
              { rule: "S3: Room Feature Affinity Matching", penalty: 0, status: "Optimal", desc: "Labs matched to CS/Civil requirements" },
              { rule: "S4: Room Hop Minimization", penalty: 3, status: "Minimised", desc: "Minimal transit between consecutive periods" },
              { rule: "S5: Morning Slot Preference for Core Courses", penalty: 0, status: "Optimal", desc: "Core subjects scheduled before noon" },
              { rule: "S6: Friday Afternoon Light Load", penalty: 0, status: "Optimal", desc: "No overload on Friday periods 7–9" },
            ].map((s) => (
              <div key={s.rule} className="flex items-center justify-between p-2.5 rounded-xl border border-[#30303A] bg-[#202027]">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[#F4F2FA]">{s.rule}</span>
                  <p className="text-[11px] text-[#71717A]">{s.desc}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-[#A78BFA]">{s.penalty} pts</span>
                  <div className="text-[10px] text-[#34D399] font-semibold">{s.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

