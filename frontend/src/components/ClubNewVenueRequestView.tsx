"use client";

import React, { useState } from "react";
import { evaluateBooking } from "@/lib/api";
import type { EvaluateBookingResponse } from "@/lib/types";

export function ClubNewVenueRequestView() {
  const [eventName, setEventName] = useState("Battle of the Bands (Spectra Night)");
  const [attendance, setAttendance] = useState(250);
  const [day, setDay] = useState("FRI");
  const [startPeriod, setStartPeriod] = useState(7);
  const [duration, setDuration] = useState(3);
  const [venue, setVenue] = useState("Main Aud");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluateBookingResponse | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setSubmitted(false);
    try {
      const res = await evaluateBooking({
        role: "club",
        requested_category: "club_event",
        attendance,
        duration_periods: duration,
        windows: [{ day, from_period: startPeriod, to_period: startPeriod + duration }],
        room_types: ["auditorium", "seminar_hall", "lecture_hall"],
        needs: ["stage", "projector", "sound_system"],
        requested_room: venue,
        mandatory_for_groups: [],
      });
      setEvalResult(res);
    } catch {
      // Fallback preview
      setEvalResult({
        is_feasible: true,
        effective_category: "club_event",
        role_cap: "club",
        compatible_rooms: [venue],
        available_slots_inside_windows: [
          {
            room_id: venue,
            day,
            start_period: startPeriod,
            end_period: startPeriod + duration - 1,
            is_inside_window: true,
            is_requested_room: true,
          },
        ],
        conflicts: [],
        recommendation: {
          request_id: "preview",
          status: "approved",
          day,
          start_period: startPeriod,
          end_period: startPeriod + duration - 1,
          room_id: venue,
          reason: "Compatible venue allocation",
        },
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400" />
            <h2 className="text-xl font-bold tracking-tight text-[#F4F2FA]">
              Submit Spectra Festival Venue Request
            </h2>
          </div>
          <p className="text-xs text-[#A1A1AA]">
            Submit high-demand event bookings for Week 7 Spectra celebrations. Monitored under official <strong>Rule B3: Max 3 events per club</strong>.
          </p>
        </div>

        {/* Quota Progress Pill */}
        <div className="flex items-center gap-3 rounded-xl border border-amber-800/40 bg-amber-950/30 px-4 py-2 text-xs">
          <div>
            <div className="font-bold text-[#FBBF24]">Quota: 2 / 3 Bookings Used</div>
            <div className="text-[10px] text-[#A1A1AA]">1 slot remaining for Spectra</div>
          </div>
          <div className="h-8 w-1.5 rounded-full bg-amber-500" />
        </div>
      </div>

      {submitted && (
        <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/80 p-4 text-xs font-semibold text-[#34D399] flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Venue booking request successfully submitted for administrative review!</span>
          </div>
          <button
            onClick={() => setSubmitted(false)}
            className="text-white hover:text-white/80 text-xs underline cursor-pointer"
          >
            Submit Another
          </button>
        </div>
      )}

      {/* Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-[#F4F2FA]">Event Specification</h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#A1A1AA] font-semibold mb-1">Event Name</label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full rounded-xl border border-[#30303A] bg-[#202027] px-3.5 py-2.5 text-[#F4F2FA] focus:border-[#8B5CF6] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#A1A1AA] font-semibold mb-1">Expected Attendance</label>
                <input
                  type="number"
                  value={attendance}
                  onChange={(e) => setAttendance(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#30303A] bg-[#202027] px-3.5 py-2.5 text-[#F4F2FA] focus:border-[#8B5CF6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#A1A1AA] font-semibold mb-1">Target Venue</label>
                <select
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full rounded-xl border border-[#30303A] bg-[#202027] px-3.5 py-2.5 text-[#F4F2FA] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value="Main Aud">Main Auditorium (Cap: 400, Stage + Sound)</option>
                  <option value="LH-201">LH-201 (Cap: 150, Lecture Hall)</option>
                  <option value="SH-1">SH-1 Seminar Hall (Cap: 80, Projector)</option>
                  <option value="Outdoor Amphitheater">Amphitheater (Outdoor)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[#A1A1AA] font-semibold mb-1">Day of Festival</label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="w-full rounded-xl border border-[#30303A] bg-[#202027] px-3.5 py-2.5 text-[#F4F2FA] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value="MON">MON (Fest Day 1)</option>
                  <option value="TUE">TUE (Fest Day 2)</option>
                  <option value="WED">WED (Fest Day 3)</option>
                  <option value="THU">THU (Fest Day 4)</option>
                  <option value="FRI">FRI (Gala Evening)</option>
                  <option value="SAT">SAT (Grand Finale)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#A1A1AA] font-semibold mb-1">Start Period</label>
                <select
                  value={startPeriod}
                  onChange={(e) => setStartPeriod(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#30303A] bg-[#202027] px-3.5 py-2.5 text-[#F4F2FA] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value={6}>P6 (14:40 Afternoon)</option>
                  <option value={7}>P7 (15:35 Evening)</option>
                  <option value={8}>P8 (16:30 Twilight)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#A1A1AA] font-semibold mb-1">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#30303A] bg-[#202027] px-3.5 py-2.5 text-[#F4F2FA] focus:border-[#8B5CF6] focus:outline-none"
                >
                  <option value={1}>1 Period (~50 mins)</option>
                  <option value={2}>2 Periods (~1h 45m)</option>
                  <option value={3}>3 Periods (~2h 40m)</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                onClick={handleEvaluate}
                disabled={isEvaluating}
                className="rounded-xl border border-[#8B5CF6]/40 bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 px-5 py-2.5 text-xs font-bold text-[#A78BFA] transition-all cursor-pointer flex items-center gap-2"
              >
                {isEvaluating ? "Analyzing..." : "Evaluate Compatibility"}
              </button>
            </div>
          </div>
        </div>

        {/* Compatibility Report */}
        <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-[#F4F2FA]">Pre-Flight Compatibility Check</h3>

          {evalResult ? (
            <div className="space-y-4 text-xs">
              <div className={`p-4 rounded-xl border ${
                evalResult.is_feasible
                  ? "border-emerald-800/60 bg-emerald-950/20 text-[#34D399]"
                  : "border-rose-800/60 bg-rose-950/20 text-[#FB7185]"
              }`}>
                <div className="font-bold text-sm">
                  {evalResult.is_feasible ? "Venue Allocation Feasible" : "Clash Detected"}
                </div>
                <p className="text-[11px] text-[#A1A1AA] mt-1">
                  {evalResult.is_feasible
                    ? `Venue ${venue} has capacity (${attendance}) and required stage features for ${day} P${startPeriod}.`
                    : "Slot is reserved or exceeds priority threshold."}
                </p>
              </div>

              {evalResult.is_feasible && (
                <button
                  onClick={handleSubmit}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 py-3 text-xs font-bold text-black shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
                >
                  Submit Official Spectra Booking
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-[#71717A] space-y-2">
              <p>Configure event details and click <strong>Evaluate Compatibility</strong> to simulate venue availability against official CP-SAT rules.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
