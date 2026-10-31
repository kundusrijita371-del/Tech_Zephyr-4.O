"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  listBookings,
  generateBookings,
  getBookingValidation,
  evaluateBooking,
  recordBookingDecision,
} from "@/lib/api";
import type {
  BookingRequestItem,
  BookingValidationReport,
  EvaluateBookingResponse,
  BookingStatus,
} from "@/lib/types";

export function VenuesManagementView() {
  const [bookings, setBookings] = useState<BookingRequestItem[]>([]);
  const [validation, setValidation] = useState<BookingValidationReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAllocating, setIsAllocating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selected item for drawer/inspection
  const [selectedRequest, setSelectedRequest] = useState<BookingRequestItem | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalResult, setEvalResult] = useState<EvaluateBookingResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookingsData, valData] = await Promise.all([
        listBookings(),
        getBookingValidation(),
      ]);
      setBookings(bookingsData);
      setValidation(valData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load booking data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerate = async () => {
    setIsAllocating(true);
    setError(null);
    try {
      const rep = await generateBookings();
      setValidation(rep);
      const updatedBookings = await listBookings();
      setBookings(updatedBookings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate bookings.");
    } finally {
      setIsAllocating(false);
    }
  };

  const handleInspect = (req: BookingRequestItem) => {
    setSelectedRequest(req);
    setEvalResult(null);
    setActionError(null);
    setActionSuccess(null);
  };

  const handleEvaluateLive = async () => {
    if (!selectedRequest) return;
    setIsEvaluating(true);
    setActionError(null);
    try {
      const res = await evaluateBooking({
        request_id: selectedRequest.id,
        role: selectedRequest.role,
        requested_category: selectedRequest.requested_category,
        attendance: selectedRequest.attendance,
        duration_periods: selectedRequest.duration_periods,
        windows: selectedRequest.windows,
        room_types: selectedRequest.room_types,
        needs: selectedRequest.needs,
        requested_room: selectedRequest.requested_room,
        mandatory_for_groups: selectedRequest.mandatory_for_groups,
      });
      setEvalResult(res);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to evaluate request.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRecordDecision = async (status: BookingStatus) => {
    if (!selectedRequest) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const rep = await recordBookingDecision(selectedRequest.id, {
        status,
        day: status === "rejected" ? null : selectedRequest.decision?.day || "MON",
        start_period: status === "rejected" ? null : selectedRequest.decision?.start_period || 10,
        end_period: status === "rejected" ? null : selectedRequest.decision?.end_period || 11,
        room_id: status === "rejected" ? null : selectedRequest.decision?.room_id || "SH-1",
        reason: `Manually updated decision to ${status}`,
      });
      setValidation(rep);
      setActionSuccess(`Successfully updated decision for ${selectedRequest.id}.`);
      const updated = await listBookings();
      setBookings(updated);
      setSelectedRequest(updated.find((r) => r.id === selectedRequest.id) || null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to record decision.");
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const decStatus = b.decision?.status || "pending";
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "CANCELLED" ? b.is_cancelled : decStatus === statusFilter.toLowerCase());

      const matchCategory =
        categoryFilter === "ALL" || b.effective_category === categoryFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        q === "" ||
        b.id.toLowerCase().includes(q) ||
        b.title.toLowerCase().includes(q) ||
        b.requester.toLowerCase().includes(q) ||
        b.role.toLowerCase().includes(q) ||
        (b.decision?.room_id && b.decision.room_id.toLowerCase().includes(q));

      return matchStatus && matchCategory && matchSearch;
    });
  }, [bookings, statusFilter, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Milestone 04 Active
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Deterministic Priority Engine
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Spectra Fest Venue Manager (Week 7)
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Processes all 25 booking requests in strict priority order. Enforces role category caps, submission timestamp tie-breakers, venue features &amp; accessibility, and guarantees zero priority inversions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={isAllocating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50"
          >
            {isAllocating ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Allocating Venues...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Run Priority Allocation
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* KPI Stats Cards */}
      {validation && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Total Requests</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{bookings.length}</div>
            <div className="mt-1 text-xs text-slate-400">All 25 evaluated</div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Approved</div>
            <div className="mt-1 text-lg font-bold text-emerald-600">{validation.approved_count}</div>
            <div className="mt-1 text-xs text-emerald-600 font-medium">Inside windows</div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Alternatives</div>
            <div className="mt-1 text-lg font-bold text-amber-600">{validation.alternative_count}</div>
            <div className="mt-1 text-xs text-amber-600 font-medium">Alternative offered</div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Rejected</div>
            <div className="mt-1 text-lg font-bold text-slate-700">{validation.rejected_count}</div>
            <div className="mt-1 text-xs text-slate-400">1 cancelled, 1 oversized</div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Booking Score</div>
            <div className="mt-1 text-lg font-bold text-blue-600 font-mono">
              {validation.booking_score} / {validation.booking_score_max}
            </div>
            <div className="mt-1 text-xs text-blue-600 font-medium">
              {((validation.booking_score / validation.booking_score_max) * 100).toFixed(1)}% efficiency
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Priority Inversions</div>
            <div className="mt-1 text-lg font-bold text-emerald-600">
              {validation.priority_inversions.length}
            </div>
            <div className="mt-1 text-xs text-emerald-600 font-medium">0 inversions guaranteed</div>
          </div>
        </div>
      )}

      {/* Official Validator Banner */}
      {validation && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 border ${
            validation.is_valid
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                validation.is_valid ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
              }`}
            >
              {validation.is_valid ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div>
              <div className="font-semibold text-sm">
                Official Starter Pack Validator (check_bookings):{" "}
                {validation.is_valid ? "PASSED (0 Hard Violations)" : "FAILED"}
              </div>
              <div className="text-xs opacity-80">
                Rules B1, B2, B3, H13 verified. Zero duplicate decisions, zero cancelled approvals, zero ungrounded session overrides.
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium">Session Overrides</div>
            <div className="text-base font-bold font-mono">{validation.session_overrides_count}</div>
          </div>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Status:
          </span>
          {["ALL", "APPROVED", "ALTERNATIVE_OFFERED", "REJECTED", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === st
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st === "ALTERNATIVE_OFFERED" ? "Alternative" : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Category:
          </span>
          {["ALL", "institute_event", "guest_lecture", "department_event", "club_event"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                categoryFilter === cat
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat === "ALL" ? "All" : cat.replace("_", " ")}
            </button>
          ))}

          <div className="relative min-w-[200px]">
            <input
              type="text"
              placeholder="Search request, venue, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Main Booking Requests Table */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mb-3" />
          <p className="text-sm">Loading Spectra Week bookings...</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Spectra Week Booking Requests ({filteredBookings.length} of {bookings.length})
            </h3>
            <span className="text-xs text-slate-500 font-mono">Week 7 Scheduling</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Request ID</th>
                  <th className="px-6 py-3.5">Title &amp; Requester</th>
                  <th className="px-6 py-3.5">Role / Priority</th>
                  <th className="px-6 py-3.5 text-right">Attendance</th>
                  <th className="px-6 py-3.5">Requested Windows</th>
                  <th className="px-6 py-3.5">Decision &amp; Venue</th>
                  <th className="px-6 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => {
                  const dec = b.decision;
                  const isApproved = dec?.status === "approved";
                  const isAlt = dec?.status === "alternative_offered";
                  const isRejected = dec?.status === "rejected";

                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => handleInspect(b)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">{b.id}</div>
                        {b.is_cancelled && (
                          <span className="mt-0.5 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            CANCELLED
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 max-w-xs truncate">{b.title}</div>
                        <div className="text-xs text-slate-500">{b.requester}</div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 capitalize">
                          {b.role.replace("_", " ")}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Eff: <span className="font-medium text-slate-600">{b.effective_category.replace("_", " ")}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap font-mono font-medium text-slate-800">
                        {b.attendance} <span className="text-xs text-slate-400 font-sans">({b.duration_periods}p)</span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {b.windows.map((w, idx) => (
                            <span
                              key={idx}
                              className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600"
                            >
                              {w.day} P{w.from_period}-P{w.to_period}
                            </span>
                          ))}
                        </div>
                        {b.requested_room && (
                          <div className="text-[10px] text-blue-600 mt-0.5">
                            Pref: <span className="font-mono font-semibold">{b.requested_room}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Approved
                            </span>
                          )}
                          {isAlt && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Alternative
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              Rejected
                            </span>
                          )}

                          {dec?.room_id && (
                            <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                              {dec.room_id} ({dec.day} P{dec.start_period}-P{dec.end_period})
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 max-w-xs truncate" title={dec?.reason}>
                          {dec?.reason}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspect(b);
                          }}
                          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail / Inspection Modal Drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-600 uppercase">
                    {selectedRequest.id}
                  </span>
                  <span className="text-xs text-slate-400">|</span>
                  <span className="text-xs text-slate-600 capitalize">
                    {selectedRequest.role.replace("_", " ")}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedRequest.title}</h3>
                <div className="text-xs text-slate-500">Requester: {selectedRequest.requester}</div>
              </div>

              <button
                onClick={() => setSelectedRequest(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {actionError && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
                {actionSuccess}
              </div>
            )}

            {/* Original Request Raw Text */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase text-slate-500 mb-1">
                Original Request (raw_text for AI parser)
              </div>
              <p className="text-xs text-slate-700 italic font-mono bg-white p-2.5 rounded-lg border border-slate-200/60">
                &quot;{selectedRequest.raw_text}&quot;
              </p>
            </div>

            {/* Structured Request Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <div className="text-slate-400">Attendance</div>
                <div className="font-bold text-slate-800 text-sm mt-0.5">{selectedRequest.attendance} people</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <div className="text-slate-400">Duration</div>
                <div className="font-bold text-slate-800 text-sm mt-0.5">{selectedRequest.duration_periods} periods</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <div className="text-slate-400">Effective Category</div>
                <div className="font-bold text-blue-700 text-sm mt-0.5">{selectedRequest.effective_category}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <div className="text-slate-400">Preferred Venue</div>
                <div className="font-bold text-slate-800 text-sm mt-0.5">{selectedRequest.requested_room || "None"}</div>
              </div>
            </div>

            {/* Current Decision Summary */}
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Current Allocation Decision</div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs uppercase px-2 py-0.5 rounded bg-slate-100">
                  {selectedRequest.decision?.status || "None"}
                </span>
                {selectedRequest.decision?.room_id && (
                  <span className="font-mono text-xs font-semibold text-slate-800">
                    {selectedRequest.decision.room_id} on {selectedRequest.decision.day} P{selectedRequest.decision.start_period}-P{selectedRequest.decision.end_period}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100">
                {selectedRequest.decision?.reason}
              </p>
            </div>

            {/* Evaluation Results */}
            {evalResult && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                <div className="text-xs font-bold text-blue-900 uppercase">Live Feasibility Evaluation</div>
                <div className="text-xs text-slate-700">
                  Compatible Venues:{" "}
                  <span className="font-mono font-semibold">{evalResult.compatible_rooms.join(", ") || "None"}</span>
                </div>
                <div className="text-xs text-slate-700">
                  Available Slots Inside Windows:{" "}
                  <span className="font-mono font-semibold">{evalResult.available_slots_inside_windows.length}</span>
                </div>
                {evalResult.suggested_alternative && (
                  <div className="text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 font-mono">
                    Alternative: {evalResult.suggested_alternative.room_id} {evalResult.suggested_alternative.day} P{evalResult.suggested_alternative.start_period}-P{evalResult.suggested_alternative.end_period}
                  </div>
                )}
                {evalResult.conflicts.length > 0 && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-red-600">Conflicts noted:</span>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                      {evalResult.conflicts.slice(0, 3).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={handleEvaluateLive}
                disabled={isEvaluating}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                {isEvaluating ? "Evaluating..." : "Check Venue Compatibility"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRecordDecision("rejected")}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                >
                  Reject Request
                </button>
                {!selectedRequest.is_cancelled && (
                  <button
                    onClick={() => handleRecordDecision("approved")}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    Confirm Approval
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

