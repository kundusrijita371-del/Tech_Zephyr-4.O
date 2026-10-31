"use client";

import React from "react";

const SPECTRA_BOOKINGS = [
  {
    id: "BK-SPEC-01",
    event: "Spectra Inaugural Ceremony",
    venue: "Main Aud",
    day: "MON",
    period: "P7–P9 (15:35–18:00)",
    status: "Approved",
    ruleCitations: "Rule B1: Priority Hierarchy; Stage & Sound System requirement met.",
    displacements: "Pre-empted CS-301 Tutorial (rescheduled to CR-104)",
  },
  {
    id: "BK-SPEC-02",
    event: "EDM DJ Night & Cultural Fest",
    venue: "Main Aud",
    day: "FRI",
    period: "P6–P9 (14:40–18:00)",
    status: "Approved",
    ruleCitations: "Rule B1: Priority Category 6 Allocation; Capacity 400 satisfied.",
    displacements: "None (Scheduled in event-only block)",
  },
  {
    id: "BK-SPEC-03",
    event: "Hackathon 24h Opening Colloquium",
    venue: "SH-1 Seminar Hall",
    day: "WED",
    period: "P7–P8 (15:35–17:15)",
    status: "Waitlist / Pending Approval",
    ruleCitations: "Rule B3: 3-event club quota limit reached. Awaiting Dean Academic sign-off.",
    displacements: "Potential clash with CSE Departmental Seminar",
  },
];

export function ClubBookingStatusView() {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400" />
            <h2 className="text-xl font-bold tracking-tight text-[#F4F2FA]">
              Spectra Booking Allocations &amp; Decision Logs
            </h2>
          </div>
          <p className="text-xs text-[#A1A1AA]">
            Track status, venue allocations, and constraint decisions for all Spectra Festival Week requests.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[#30303A] bg-[#202027] px-3 py-1.5 text-xs text-[#A1A1AA]">
          <span className="font-mono text-[#A78BFA]">3 Requests Tracked</span>
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {SPECTRA_BOOKINGS.map((bk) => (
          <div
            key={bk.id}
            className="rounded-2xl border border-[#30303A] bg-[#19191F] p-5 shadow-sm space-y-3 hover:border-[#8B5CF6]/50 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#30303A] pb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[#A78BFA] bg-[#141419] px-2.5 py-1 rounded-lg border border-[#30303A]">
                  {bk.id}
                </span>
                <h3 className="text-sm font-bold text-[#F4F2FA]">{bk.event}</h3>
              </div>

              <span
                className={`rounded-full px-3 py-0.5 text-[10px] font-bold border w-fit ${
                  bk.status === "Approved"
                    ? "bg-emerald-950/60 border-emerald-800/40 text-[#34D399]"
                    : "bg-amber-950/60 border-amber-800/40 text-[#FBBF24]"
                }`}
              >
                {bk.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-[#30303A] bg-[#202027] p-3 space-y-0.5">
                <span className="text-[10px] text-[#71717A] uppercase font-semibold">Allocated Venue</span>
                <p className="font-bold text-[#F4F2FA]">{bk.venue}</p>
              </div>
              <div className="rounded-xl border border-[#30303A] bg-[#202027] p-3 space-y-0.5">
                <span className="text-[10px] text-[#71717A] uppercase font-semibold">Scheduled Time</span>
                <p className="font-bold text-[#A78BFA]">{bk.day} {bk.period}</p>
              </div>
              <div className="rounded-xl border border-[#30303A] bg-[#202027] p-3 space-y-0.5">
                <span className="text-[10px] text-[#71717A] uppercase font-semibold">Session Displacements</span>
                <p className="font-semibold text-[#34D399]">{bk.displacements}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[#30303A] bg-[#141419] p-3 text-xs text-[#A1A1AA] flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#71717A] uppercase font-bold shrink-0">Official Decision:</span>
              <span>{bk.ruleCitations}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
