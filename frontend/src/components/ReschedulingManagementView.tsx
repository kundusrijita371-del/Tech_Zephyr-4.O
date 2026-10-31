"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  previewDisruptionRepair,
  listRepairProposals,
  approveRepairProposal,
  rejectRepairProposal,
  getScheduleVersionHistory,
} from "@/lib/api";
import type {
  DisruptionCategory,
  DisruptionRequestPayload,
  DisruptionSeverityLevel,
  ImpactReportData,
  RepairProposalData,
  ScheduleVersionAuditRecord,
} from "@/lib/types";

export function ReschedulingManagementView() {
  // Form State
  const [disruptionId, setDisruptionId] = useState<string>("dis-room-102");
  const [disruptionType, setDisruptionType] = useState<DisruptionCategory>("ROOM_UNAVAILABLE");
  const [resourceId, setResourceId] = useState<string>("CR-102");
  const [affectedDay, setAffectedDay] = useState<string>("MON");
  const [startPeriod, setStartPeriod] = useState<number>(1);
  const [endPeriod, setEndPeriod] = useState<number>(9);
  const [severity, setSeverity] = useState<DisruptionSeverityLevel>("high");
  const [reportedBy, setReportedBy] = useState<string>("Facilities & Estates");
  const [reason, setReason] = useState<string>("Water pipe leakage and flooring repair");

  // Approval Form State
  const [approverName, setApproverName] = useState<string>("Dean Academic");
  const [decisionNotes, setDecisionNotes] = useState<string>("Approved repair following campus inspection");

  // Data State
  const [currentProposal, setCurrentProposal] = useState<RepairProposalData | null>(null);
  const [proposalsList, setProposalsList] = useState<RepairProposalData[]>([]);
  const [versionHistory, setVersionHistory] = useState<ScheduleVersionAuditRecord[]>([]);

  // UI State
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "history">("preview");

  const loadData = useCallback(async () => {
    try {
      const [props, hist] = await Promise.all([
        listRepairProposals().catch(() => []),
        getScheduleVersionHistory().catch(() => []),
      ]);
      setProposalsList(props);
      setVersionHistory(hist);
      if (props.length > 0 && !currentProposal) {
        setCurrentProposal(props[0]);
      }
    } catch {
      // Ignore background load failures
    }
  }, [currentProposal]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGeneratePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPreview(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload: DisruptionRequestPayload = {
      disruption_id: disruptionId.trim() || `dis-${Date.now()}`,
      disruption_type: disruptionType,
      resource_id: resourceId.trim(),
      affected_day: affectedDay,
      affected_days: [affectedDay],
      start_period: Number(startPeriod),
      end_period: Number(endPeriod),
      reason: reason.trim(),
      reported_by: reportedBy.trim(),
      severity: severity,
    };

    try {
      const proposal = await previewDisruptionRepair(payload);
      setCurrentProposal(proposal);
      setSuccessMessage(
        `Repair proposal ${proposal.proposal_id} generated successfully! Solver status: ${proposal.solver_status}.`
      );
      loadData();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate repair proposal."
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApprove = async () => {
    if (!currentProposal) return;
    setLoadingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const record = await approveRepairProposal(currentProposal.proposal_id, {
        decided_by: approverName.trim() || "Dean Academic",
        reason: decisionNotes.trim(),
      });
      setSuccessMessage(
        `Proposal ${currentProposal.proposal_id} approved! Schedule updated to Version ${record.version_number}. Previous schedule archived.`
      );
      // Reload proposals and history
      const [props, hist] = await Promise.all([
        listRepairProposals(),
        getScheduleVersionHistory(),
      ]);
      setProposalsList(props);
      setVersionHistory(hist);
      const updated = props.find((p) => p.proposal_id === currentProposal.proposal_id);
      if (updated) setCurrentProposal(updated);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to approve proposal."
      );
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReject = async () => {
    if (!currentProposal) return;
    setLoadingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const rejected = await rejectRepairProposal(currentProposal.proposal_id, {
        decided_by: approverName.trim() || "Admin",
        reason: decisionNotes.trim() || "Rejected by administrator",
      });
      setSuccessMessage(`Proposal ${currentProposal.proposal_id} rejected. Active schedule remains untouched.`);
      setCurrentProposal(rejected);
      const props = await listRepairProposals();
      setProposalsList(props);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to reject proposal."
      );
    } finally {
      setLoadingAction(false);
    }
  };

  const applyPreset = (preset: "CR-102" | "F07" | "CR-201") => {
    if (preset === "CR-102") {
      setDisruptionId("dis-cr102-water");
      setDisruptionType("ROOM_UNAVAILABLE");
      setResourceId("CR-102");
      setAffectedDay("MON");
      setStartPeriod(1);
      setEndPeriod(9);
      setSeverity("high");
      setReportedBy("Facilities Team");
      setReason("Water pipe leakage and flooring repair");
    } else if (preset === "F07") {
      setDisruptionId("dis-f07-symposium");
      setDisruptionType("FACULTY_UNAVAILABLE");
      setResourceId("F07");
      setAffectedDay("MON");
      setStartPeriod(1);
      setEndPeriod(9);
      setSeverity("medium");
      setReportedBy("HoD Computer Science");
      setReason("Conference travel and external research symposium");
    } else if (preset === "CR-201") {
      setDisruptionId("dis-cr201-av");
      setDisruptionType("ROOM_MAINTENANCE");
      setResourceId("CR-201");
      setAffectedDay("WED");
      setStartPeriod(3);
      setEndPeriod(6);
      setSeverity("low");
      setReportedBy("AV Support Desk");
      setReason("Interactive smart projector replacement");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Intelligent Disruption & Timetable Repair Engine</span>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              OR-Tools CP-SAT
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Simulate outages, compute cascade blast radius, preview minimal-change repairs, and atomically commit verified schedule revisions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "preview"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Disruption & Repair
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "history"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Version History ({versionHistory.length})
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 flex items-start gap-2">
          <svg className="h-4 w-4 shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>{errorMessage}</div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 flex items-start gap-2">
          <svg className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>{successMessage}</div>
        </div>
      )}

      {activeTab === "preview" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Disruption Input Form (Left 4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Report Campus Disruption
                </h3>
                <span className="text-[11px] text-slate-400">Step 1</span>
              </div>

              {/* Quick Presets */}
              <div className="mt-3">
                <div className="text-[11px] font-medium text-slate-500 mb-1.5">Quick Scenarios:</div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset("CR-102")}
                    className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                  >
                    CR-102 Leak (All Mon)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("F07")}
                    className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                  >
                    F07 Leave (Mon)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("CR-201")}
                    className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                  >
                    CR-201 AV (Wed P3-P6)
                  </button>
                </div>
              </div>

              <form onSubmit={handleGeneratePreview} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Disruption ID</label>
                  <input
                    type="text"
                    value={disruptionId}
                    onChange={(e) => setDisruptionId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Disruption Type</label>
                    <select
                      value={disruptionType}
                      onChange={(e) => setDisruptionType(e.target.value as DisruptionCategory)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-900 focus:border-blue-500"
                    >
                      <option value="ROOM_UNAVAILABLE">Room Outage</option>
                      <option value="FACULTY_UNAVAILABLE">Faculty Leave</option>
                      <option value="ROOM_MAINTENANCE">Maintenance</option>
                      <option value="EXAM_ROOM_UNAVAILABLE">Exam Room Disruption</option>
                      <option value="MULTIPLE_RESOURCE_DISRUPTION">Multiple Resources</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Resource ID</label>
                    <input
                      type="text"
                      value={resourceId}
                      onChange={(e) => setResourceId(e.target.value)}
                      placeholder="e.g. CR-102 or F07"
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Day</label>
                    <select
                      value={affectedDay}
                      onChange={(e) => setAffectedDay(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-slate-900 focus:border-blue-500"
                    >
                      <option value="MON">MON</option>
                      <option value="TUE">TUE</option>
                      <option value="WED">WED</option>
                      <option value="THU">THU</option>
                      <option value="FRI">FRI</option>
                      <option value="SAT">SAT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Start P</label>
                    <input
                      type="number"
                      min={1}
                      max={13}
                      value={startPeriod}
                      onChange={(e) => setStartPeriod(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-slate-900 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">End P</label>
                    <input
                      type="number"
                      min={1}
                      max={13}
                      value={endPeriod}
                      onChange={(e) => setEndPeriod(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-slate-900 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Severity</label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as DisruptionSeverityLevel)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-900 focus:border-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Reported By</label>
                    <input
                      type="text"
                      value={reportedBy}
                      onChange={(e) => setReportedBy(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Operational Reason</label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingPreview}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingPreview ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Simulating CP-SAT Repair...</span>
                    </>
                  ) : (
                    <span>Analyze & Generate Preview</span>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Proposal Review & Action (Right 8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            {currentProposal ? (
              <>
                {/* Proposal Overview Banner */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          Proposal: {currentProposal.proposal_id}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            currentProposal.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : currentProposal.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : currentProposal.status === "stale"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {currentProposal.status.toUpperCase()}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                          Solver: {currentProposal.solver_status} ({currentProposal.solve_time_seconds}s)
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Disruption: <span className="font-mono text-slate-700">{currentProposal.disruption_id}</span> • Created: {new Date(currentProposal.created_at).toLocaleString()}
                      </p>
                    </div>

                    {/* Official Validator Badge */}
                    <div className="flex items-center gap-2">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-right">
                        <div className="text-[10px] font-bold uppercase text-emerald-600">Official Validator</div>
                        <div className="text-sm font-bold text-emerald-900">
                          {currentProposal.validation_report.hard_violation_count} Hard Violations
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                      <div className="text-[10px] uppercase font-medium text-slate-500">Sessions Moved</div>
                      <div className="text-lg font-bold text-slate-900 font-mono">
                        {currentProposal.changed_sessions.length}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                      <div className="text-[10px] uppercase font-medium text-slate-500">Room Relocations Only</div>
                      <div className="text-lg font-bold text-emerald-600 font-mono">
                        {currentProposal.changed_sessions.filter((s) => s.change_type === "room_only").length}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                      <div className="text-[10px] uppercase font-medium text-slate-500">Time Shifts</div>
                      <div className="text-lg font-bold text-blue-600 font-mono">
                        {currentProposal.changed_sessions.filter((s) => s.change_type !== "room_only").length}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                      <div className="text-[10px] uppercase font-medium text-slate-500">Soft Penalty</div>
                      <div className="text-lg font-bold text-slate-700 font-mono">
                        {currentProposal.validation_report.soft_penalty}
                      </div>
                    </div>
                  </div>

                  {/* Diff Comparison Table */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Before & After Schedule Modifications ({currentProposal.changed_sessions.length})
                    </h4>
                    {currentProposal.changed_sessions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                        No sessions were required to move for this disruption.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                            <tr>
                              <th className="px-3 py-2">Session ID</th>
                              <th className="px-3 py-2">Course / Faculty</th>
                              <th className="px-3 py-2">Original Slot</th>
                              <th className="px-3 py-2">Proposed Slot</th>
                              <th className="px-3 py-2">Change Type</th>
                              <th className="px-3 py-2">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {currentProposal.changed_sessions.map((item) => (
                              <tr key={item.session_id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-mono font-medium text-slate-900">
                                  {item.session_id}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {item.course_id} • <span className="font-mono">{item.faculty_id}</span>
                                </td>
                                <td className="px-3 py-2 text-red-600 font-mono">
                                  {item.original_day}-P{item.original_start_period} in {item.original_room_id}
                                </td>
                                <td className="px-3 py-2 text-emerald-700 font-mono font-medium">
                                  {item.proposed_day}-P{item.proposed_start_period} in {item.proposed_room_id}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                      item.change_type === "room_only"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {item.change_type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-[11px] text-slate-500 max-w-xs truncate">
                                  {item.reason}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Stage B: Administrator Approval Controls */}
                  {currentProposal.status === "pending" && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                          Stage B: Administrator Review & Atomic Schedule Commit
                        </div>
                        <span className="text-[11px] text-blue-700">Two-Stage Workflow</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Approving Admin</label>
                          <input
                            type="text"
                            value={approverName}
                            onChange={(e) => setApproverName(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Decision Comments</label>
                          <input
                            type="text"
                            value={decisionNotes}
                            onChange={(e) => setDecisionNotes(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={handleReject}
                          disabled={loadingAction}
                          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition"
                        >
                          Reject Proposal
                        </button>
                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={loadingAction}
                          className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition flex items-center gap-1.5"
                        >
                          {loadingAction ? (
                            <span>Committing Atomic Version...</span>
                          ) : (
                            <>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Approve & Commit Schedule</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
                <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="mt-3 text-sm font-bold text-slate-700">No Disruption Selected</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select a preset on the left or fill out the form to simulate impact and formulate a repair proposal.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* History View */
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Audited Schedule Versions & Commit History
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every approved change archives previous versions for full traceability and rollback protection.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {versionHistory.length} Recorded Versions
            </span>
          </div>

          {versionHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No schedule revisions have been committed yet. The active schedule is at baseline Version 0.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                  <tr>
                    <th className="px-3 py-2.5">Version</th>
                    <th className="px-3 py-2.5">Disruption ID</th>
                    <th className="px-3 py-2.5">Approved By</th>
                    <th className="px-3 py-2.5">Timestamp</th>
                    <th className="px-3 py-2.5">Sessions Moved</th>
                    <th className="px-3 py-2.5">Hard Violations</th>
                    <th className="px-3 py-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {versionHistory.map((v) => (
                    <tr key={v.version_id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-mono font-bold text-blue-600">
                        {v.version_id}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium text-slate-800">
                        {v.disruption_id}
                      </td>
                      <td className="px-3 py-2 text-slate-700 font-medium">
                        {v.approved_by}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {new Date(v.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-800">
                        {v.sessions_moved_count}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          {v.hard_violation_count}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 max-w-sm truncate">
                        {v.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

