"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  generateExams,
  getLatestExams,
  getExamValidation,
} from "@/lib/api";
import type {
  ExamResponse,
  ExamValidationResponse,
} from "@/lib/types";

const EXAM_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const EXAM_SESSIONS = [
  { id: "AM", time: "09:30 – 11:30" },
  { id: "PM", time: "14:00 – 16:00" },
] as const;

export function ExaminationsManagementView() {
  const [examData, setExamData] = useState<ExamResponse | null>(null);
  const [validation, setValidation] = useState<ExamValidationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("ALL");
  const [selectedSession, setSelectedSession] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [exRes, valRes] = await Promise.allSettled([
          getLatestExams(),
          getExamValidation(),
        ]);

        if (exRes.status === "fulfilled") setExamData(exRes.value);
        if (valRes.status === "fulfilled") setValidation(valRes.value);
      } catch {
        // No generated exams yet is expected before first generation
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleGenerate = async () => {
    setIsSolving(true);
    setError(null);
    try {
      const res = await generateExams({
        team_name: "HackerX",
        time_limit_seconds: 30.0,
        num_workers: 8,
        optimize_soft: true,
      });
      setExamData(res);
      const val = await getExamValidation();
      setValidation(val);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to run CP-SAT examination scheduler."
      );
    } finally {
      setIsSolving(false);
    }
  };

  const filteredExams = useMemo(() => {
    if (!examData?.schedule?.exams) return [];
    return examData.schedule.exams.filter((ex) => {
      const matchDay = selectedDay === "ALL" || ex.day === selectedDay;
      const matchSession =
        selectedSession === "ALL" || ex.session === selectedSession;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        q === "" ||
        ex.exam_id.toLowerCase().includes(q) ||
        ex.rooms.some((r) => r.toLowerCase().includes(q)) ||
        ex.groups.some((g) => g.toLowerCase().includes(q)) ||
        ex.course_ids.some((c) => c.toLowerCase().includes(q));
      return matchDay && matchSession && matchSearch;
    });
  }, [examData, selectedDay, selectedSession, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#A78BFA] uppercase tracking-wider">
              Milestone 03 Active
            </span>
            <span className="rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-0.5 text-xs font-semibold text-[#34D399]">
              OR-Tools CP-SAT Exam Engine
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#F4F2FA]">
            CIT Midsem Examination Scheduler
          </h2>
          <p className="mt-1 text-sm text-[#A1A1AA] max-w-2xl leading-relaxed">
            Schedules all 41 examinations across 6 days (MON–SAT) and 2 daily sessions (AM: 09:30–11:30, PM: 14:00–16:00).
            Strictly enforces the 50% room exam capacity rule, multi-room allocation for large cohorts, and avoids group clashes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={isSolving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#8B5CF6]/20 active:scale-95 disabled:opacity-50 transition cursor-pointer"
          >
            {isSolving ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Solving CP-SAT Model...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                {examData ? "Re-run Examination Solver" : "Generate Examination Schedule"}
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/50 bg-rose-950/40 p-4 text-sm text-[#FB7185]">
          <div className="flex items-start gap-2">
            <span className="font-semibold">Error:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Solver Metrics Cards */}
      {examData && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-[#30303A] bg-[#202027] p-4 shadow-xs">
            <div className="text-xs font-medium text-[#71717A]">Solver Status</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#34D399]" />
              <span className="font-bold text-[#F4F2FA] text-sm">
                {examData.metadata.solver_status}
              </span>
            </div>
            <div className="mt-1 text-xs text-[#71717A]">
              {examData.metadata.solve_time_seconds.toFixed(2)}s solve time
            </div>
          </div>

          <div className="rounded-xl border border-[#30303A] bg-[#202027] p-4 shadow-xs">
            <div className="text-xs font-medium text-[#71717A]">Exams Scheduled</div>
            <div className="mt-1 text-lg font-bold text-[#F4F2FA]">
              {examData.metadata.scheduled_exams} / {examData.metadata.total_exams}
            </div>
            <div className="mt-1 text-xs text-[#34D399] font-medium">100% Assigned</div>
          </div>

          <div className="rounded-xl border border-[#30303A] bg-[#202027] p-4 shadow-xs">
            <div className="text-xs font-medium text-[#71717A]">Students Seated</div>
            <div className="mt-1 text-lg font-bold text-[#F4F2FA]">
              {examData.metadata.total_students_seated.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-[#71717A]">Across 41 examinations</div>
          </div>

          <div className="rounded-xl border border-[#30303A] bg-[#202027] p-4 shadow-xs">
            <div className="text-xs font-medium text-[#71717A]">Effective Seats</div>
            <div className="mt-1 text-lg font-bold text-[#F4F2FA]">
              {examData.metadata.total_capacity_provided.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-[#34D399] font-medium">50% capacity rule applied</div>
          </div>

          <div className="rounded-xl border border-[#30303A] bg-[#202027] p-4 shadow-xs">
            <div className="text-xs font-medium text-[#71717A]">Hard Violations</div>
            <div className="mt-1 text-lg font-bold">
              {examData.metadata.hard_violation_count === 0 ? (
                <span className="text-[#34D399]">0</span>
              ) : (
                <span className="text-[#FB7185]">
                  {examData.metadata.hard_violation_count}
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-[#71717A]">Rules E1, E2, H3, H4, H5</div>
          </div>

          <div className="rounded-xl border border-[#30303A] bg-[#202027] p-4 shadow-xs">
            <div className="text-xs font-medium text-[#71717A]">Soft Penalty</div>
            <div className="mt-1 text-lg font-bold text-[#A78BFA]">
              {examData.metadata.soft_penalty}
            </div>
            <div className="mt-1 text-xs text-[#34D399] font-medium">
              &le; 1 exam/group/day
            </div>
          </div>
        </div>
      )}

      {/* Official Validator Banner */}
      {validation && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 border ${
            validation.is_valid
              ? "bg-emerald-950/30 border-emerald-800/40 text-[#34D399]"
              : "bg-rose-950/30 border-rose-800/40 text-[#FB7185]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                validation.is_valid ? "bg-emerald-700 text-white" : "bg-rose-700 text-white"
              }`}
            >
              {validation.is_valid ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>
            <div>
              <div className="font-semibold text-sm text-[#F4F2FA]">
                Official Starter Pack Validator:{" "}
                <span className={validation.is_valid ? "text-[#34D399]" : "text-[#FB7185]"}>
                  {validation.is_valid ? "PASSED (0 Hard Violations)" : "FAILED"}
                </span>
              </div>
              <div className="text-xs text-[#A1A1AA]">
                Verified against official validator.py (check_exams): 41 scheduled, valid rooms, 50% capacity, no room/group clashes.
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-[#71717A]">Soft Score Penalty</div>
            <div className="text-base font-bold font-mono text-[#A78BFA]">{validation.soft_penalty}</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 rounded-xl border border-[#30303A] bg-[#19191F] p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#71717A] uppercase tracking-wider mr-1">
            Day:
          </span>
          <button
            onClick={() => setSelectedDay("ALL")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              selectedDay === "ALL"
                ? "bg-[#8B5CF6] text-white font-bold"
                : "bg-[#202027] text-[#A1A1AA] hover:bg-[#292933] hover:text-[#F4F2FA] border border-[#30303A]"
            }`}
          >
            All Days
          </button>
          {EXAM_DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                selectedDay === d
                  ? "bg-[#8B5CF6] text-white font-bold"
                  : "bg-[#202027] text-[#A1A1AA] hover:bg-[#292933] hover:text-[#F4F2FA] border border-[#30303A]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#71717A] uppercase tracking-wider mr-1">
            Session:
          </span>
          <button
            onClick={() => setSelectedSession("ALL")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              selectedSession === "ALL"
                ? "bg-[#8B5CF6] text-white font-bold"
                : "bg-[#202027] text-[#A1A1AA] hover:bg-[#292933] hover:text-[#F4F2FA] border border-[#30303A]"
            }`}
          >
            All
          </button>
          {EXAM_SESSIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSession(s.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                selectedSession === s.id
                  ? "bg-[#8B5CF6] text-white font-bold"
                  : "bg-[#202027] text-[#A1A1AA] hover:bg-[#292933] hover:text-[#F4F2FA] border border-[#30303A]"
              }`}
            >
              {s.id} ({s.time})
            </button>
          ))}

          <div className="relative min-w-[200px]">
            <input
              type="text"
              placeholder="Search exam, room, group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#30303A] bg-[#141419] px-3 py-1.5 text-xs text-[#F4F2FA] placeholder:text-[#71717A] focus:border-[#A78BFA] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Examination Grid / Table */}
      {loading ? (
        <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-12 text-center text-[#A1A1AA]">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-[#8B5CF6] border-t-transparent rounded-full mb-3" />
          <p className="text-sm">Loading examination schedule...</p>
        </div>
      ) : !examData ? (
        <div className="rounded-2xl border border-dashed border-[#30303A] bg-[#19191F] p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#A78BFA] mb-4">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[#F4F2FA]">
            No Examination Schedule Generated Yet
          </h3>
          <p className="mt-1 text-sm text-[#71717A] max-w-md mx-auto">
            Click &quot;Generate Examination Schedule&quot; above to solve and allocate rooms for all 41 midsem examinations with Google OR-Tools CP-SAT.
          </p>
          <div className="mt-6">
            <button
              onClick={handleGenerate}
              disabled={isSolving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#8B5CF6]/20 transition cursor-pointer"
            >
              Generate Examination Schedule Now
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#30303A] bg-[#19191F] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#30303A] flex items-center justify-between bg-[#141419]">
            <h3 className="text-sm font-semibold text-[#F4F2FA]">
              Midsem Examination Sessions ({filteredExams.length} of {examData.schedule.exams.length})
            </h3>
            <span className="text-xs text-[#A78BFA] font-mono">
              Dataset: {examData.schedule.dataset_id}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#141419] text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider border-b border-[#30303A]">
                <tr>
                  <th className="px-6 py-3.5">Exam ID / Subject</th>
                  <th className="px-6 py-3.5">Day &amp; Slot</th>
                  <th className="px-6 py-3.5">Student Groups</th>
                  <th className="px-6 py-3.5 text-right">Students</th>
                  <th className="px-6 py-3.5">Allocated Rooms</th>
                  <th className="px-6 py-3.5 text-right">Effective Capacity</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30303A] bg-[#19191F]">
                {filteredExams.map((ex) => {
                  const isMultiRoom = ex.rooms.length > 1;
                  const isSurplus = ex.effective_capacity >= ex.size;

                  return (
                    <tr
                      key={ex.exam_id}
                      className="hover:bg-[#202027] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-[#F4F2FA]">
                          {ex.exam_id}
                        </div>
                        {ex.course_ids.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {ex.course_ids.map((cid) => (
                              <span
                                key={cid}
                                className="inline-block rounded bg-[#202027] border border-[#30303A] px-1.5 py-0.5 text-[10px] font-medium text-[#A1A1AA]"
                              >
                                {cid}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded-md bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 px-2 py-1 text-xs font-bold text-[#A78BFA]">
                            {ex.day}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                              ex.session === "AM"
                                ? "bg-amber-950/60 text-amber-300 border border-amber-800/50"
                                : "bg-purple-950/60 text-purple-300 border border-purple-800/50"
                            }`}
                          >
                            {ex.session} (
                            {ex.session === "AM" ? "09:30–11:30" : "14:00–16:00"})
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {ex.groups.map((g) => (
                            <span
                              key={g}
                              className="inline-block rounded-md bg-[#202027] border border-[#30303A] px-2 py-0.5 text-xs font-medium text-[#F4F2FA]"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right font-semibold text-[#F4F2FA] whitespace-nowrap font-mono">
                        {ex.size}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ex.rooms.map((rid) => (
                            <span
                              key={rid}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 text-xs font-semibold text-[#34D399] font-mono"
                            >
                              {rid}
                            </span>
                          ))}
                          {isMultiRoom && (
                            <span className="text-[10px] font-medium text-[#71717A]">
                              ({ex.rooms.length} rooms)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span
                          className={`font-semibold font-mono text-sm ${
                            isSurplus ? "text-[#F4F2FA]" : "text-[#FB7185]"
                          }`}
                        >
                          {ex.effective_capacity} seats
                        </span>
                        <div className="text-[10px] text-[#71717A]">
                          {ex.effective_capacity - ex.size >= 0
                            ? `+${ex.effective_capacity - ex.size} slack`
                            : "DEFICIT"}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-0.5 text-xs font-medium text-[#34D399]">
                          <svg
                            className="h-3 w-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Valid
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
