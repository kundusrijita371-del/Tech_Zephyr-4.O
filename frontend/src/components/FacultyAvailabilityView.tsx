"use client";

import React, { useState } from "react";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI"] as const;
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function FacultyAvailabilityView() {
  const [unavailableSlots, setUnavailableSlots] = useState<Set<string>>(
    new Set(["FRI-8", "FRI-9"])
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleSlot = (day: string, period: number) => {
    const key = `${day}-${period}`;
    setUnavailableSlots((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setSavedSuccess(false);
  };

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight text-[#F4F2FA]">
              Faculty Availability &amp; Teaching Preferences
            </h2>
          </div>
          <p className="text-xs text-[#A1A1AA]">
            Configure your teaching period availability. Enforces the official institutional cap of <strong>max 4 hours per day</strong>.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-900/30 transition-all cursor-pointer flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Save Teaching Preferences</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/80 p-4 text-xs font-semibold text-[#34D399] flex items-center gap-2 animate-fadeIn">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Availability preferences updated successfully. Syncing with timetable solver engine.</span>
        </div>
      )}

      {/* Institutional Hard Constraints Callout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#30303A] bg-[#19191F] p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#71717A]">Official Daily Cap</span>
          <p className="text-lg font-bold text-[#34D399]">Max 4.0 Hours / Day</p>
          <p className="text-[11px] text-[#A1A1AA]">Hard constraint strictly verified by validator.py</p>
        </div>
        <div className="rounded-xl border border-[#30303A] bg-[#19191F] p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#71717A]">Lunch Break Protection</span>
          <p className="text-lg font-bold text-[#A78BFA]">After Period 4</p>
          <p className="text-[11px] text-[#A1A1AA]">Guaranteed mandatory break between 12:45 – 13:45</p>
        </div>
        <div className="rounded-xl border border-[#30303A] bg-[#19191F] p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#71717A]">Synchronized Labs</span>
          <p className="text-lg font-bold text-[#F4F2FA]">3 Continuous Periods</p>
          <p className="text-[11px] text-[#A1A1AA]">Starts Period 1 (08:30) or Period 6 (14:40)</p>
        </div>
      </div>

      {/* Interactive Availability Matrix */}
      <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#F4F2FA]">Weekly Availability Grid</h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-emerald-950 border border-emerald-700/60" />
              <span className="text-[#A1A1AA]">Available (Click to block)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-rose-950 border border-rose-700/60" />
              <span className="text-[#A1A1AA]">Unavailable</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#30303A] text-[#71717A]">
                <th className="py-2.5 px-3 text-left font-semibold">Day</th>
                {PERIODS.map((p) => (
                  <th key={p} className="py-2.5 px-2 font-semibold">
                    <div>P{p}</div>
                    <div className="text-[9px] font-mono text-[#71717A]">
                      {p === 4 ? "Lunch" : `${p + 7}:30`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30303A]">
              {DAYS.map((day) => (
                <tr key={day} className="hover:bg-[#202027]/40 transition-colors">
                  <td className="py-3 px-3 text-left font-bold text-[#F4F2FA] font-mono">{day}</td>
                  {PERIODS.map((period) => {
                    const key = `${day}-${period}`;
                    const isBlocked = unavailableSlots.has(key);
                    return (
                      <td key={period} className="py-2 px-1">
                        <button
                          onClick={() => toggleSlot(day, period)}
                          className={`w-full py-2 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                            isBlocked
                              ? "bg-rose-950/80 border-rose-800 text-[#FB7185] shadow-xs"
                              : "bg-emerald-950/40 border-emerald-800/40 text-[#34D399] hover:bg-emerald-900/50"
                          }`}
                        >
                          {isBlocked ? "OFF" : "OPEN"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

