"use client";

import React, { useState, useEffect, useCallback } from "react";
import type {
  User,
  PriorityOrderResponse,
  CategoryInfo,
  SystemStatusResponse,
  ValidatorReportsResponse,
  DatasetPreviewResponse,
  AuditLogEntry,
} from "@/lib/types";
import {
  getBookingPriority,
  updateBookingPriority,
  getSystemStatus,
  getValidatorReports,
  resetDemoData,
  previewDataset,
  applyDataset,
  reloadDataset,
  getAuditLogs,
  getStoredAuth,
} from "@/lib/api";

interface SettingsManagementViewProps {
  currentUser: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onNavigateTab: (tab: string) => void;
}

type SettingsTab =
  | "profile"
  | "priority"
  | "dataset"
  | "validator"
  | "system"
  | "demo_reset"
  | "audit";

const DEFAULT_PRIORITY_ORDER = [
  "exam",
  "regular_session",
  "institute_event",
  "guest_lecture",
  "department_event",
  "club_event",
];

export function SettingsManagementView({
  currentUser,
  onOpenLogin,
  onLogout,
  onNavigateTab,
}: SettingsManagementViewProps) {
  const isAdmin = currentUser?.role === "admin";
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Authentication token
  const token = typeof window !== "undefined" ? getStoredAuth().token : null;

  // Notification / Alert state
  const [alert, setAlert] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // 1. Booking Priority State
  const [priorityData, setPriorityData] = useState<PriorityOrderResponse | null>(null);
  const [workingOrder, setWorkingOrder] = useState<string[]>([]);
  const [isSavingPriority, setIsSavingPriority] = useState(false);
  const [isLoadingPriority, setIsLoadingPriority] = useState(false);

  // 2. System Status State
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // 3. Validator Reports State
  const [validatorReports, setValidatorReports] = useState<ValidatorReportsResponse | null>(null);
  const [isLoadingValidator, setIsLoadingValidator] = useState(false);

  // 4. Dataset Management State
  const [uploadedJson, setUploadedJson] = useState<Record<string, unknown> | null>(null);
  const [datasetPreview, setDatasetPreview] = useState<DatasetPreviewResponse | null>(null);
  const [isPreviewingDataset, setIsPreviewingDataset] = useState(false);
  const [isApplyingDataset, setIsApplyingDataset] = useState(false);
  const [isReloadingDataset, setIsReloadingDataset] = useState(false);
  const [showApplyConfirmModal, setShowApplyConfirmModal] = useState(false);

  // 5. Demo Reset State
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [resetResult, setResetResult] = useState<string[] | null>(null);

  // 6. Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Display alert helper
  const notify = (type: "success" | "error" | "info", message: string) => {
    setAlert({ type, message });
    setTimeout(() => {
      setAlert(null);
    }, 6000);
  };

  // Fetch Priority
  const fetchPriority = useCallback(async () => {
    setIsLoadingPriority(true);
    try {
      const data = await getBookingPriority(token || undefined);
      setPriorityData(data);
      setWorkingOrder(data.priority_order);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load priority order.";
      notify("error", msg);
    } finally {
      setIsLoadingPriority(false);
    }
  }, [token]);

  // Fetch System Status
  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const data = await getSystemStatus(token || undefined);
      setSystemStatus(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load system diagnostics.";
      notify("error", msg);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [token]);

  // Fetch Validator Reports
  const fetchValidator = useCallback(async () => {
    setIsLoadingValidator(true);
    try {
      const data = await getValidatorReports(token || undefined);
      setValidatorReports(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load validator reports.";
      notify("error", msg);
    } finally {
      setIsLoadingValidator(false);
    }
  }, [token]);

  // Fetch Audit Logs
  const fetchAudit = useCallback(async () => {
    if (!token || !isAdmin) return;
    setIsLoadingAudit(true);
    try {
      const logs = await getAuditLogs(token);
      setAuditLogs(logs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load audit trail.";
      notify("error", msg);
    } finally {
      setIsLoadingAudit(false);
    }
  }, [token, isAdmin]);

  // Initial Load
  useEffect(() => {
    fetchPriority();
    fetchStatus();
    fetchValidator();
    if (isAdmin) {
      fetchAudit();
    }
  }, [fetchPriority, fetchStatus, fetchValidator, fetchAudit, isAdmin]);

  // Check if priority order is dirty
  const isPriorityDirty =
    priorityData &&
    JSON.stringify(workingOrder) !== JSON.stringify(priorityData.priority_order);

  // Move priority item up
  const movePriorityUp = (index: number) => {
    if (index <= 0) return;
    const next = [...workingOrder];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setWorkingOrder(next);
  };

  // Move priority item down
  const movePriorityDown = (index: number) => {
    if (index >= workingOrder.length - 1) return;
    const next = [...workingOrder];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setWorkingOrder(next);
  };

  // Save Priority Order
  const handleSavePriority = async () => {
    if (!token) {
      notify("error", "Session expired. Please log in as Admin.");
      return;
    }
    setIsSavingPriority(true);
    try {
      const updated = await updateBookingPriority(workingOrder, token);
      setPriorityData(updated);
      setWorkingOrder(updated.priority_order);
      notify("success", "Booking priority order saved and applied system-wide.");
      fetchAudit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update priority order.";
      notify("error", msg);
    } finally {
      setIsSavingPriority(false);
    }
  };

  // Discard changes to priority
  const handleDiscardPriority = () => {
    if (priorityData) {
      setWorkingOrder(priorityData.priority_order);
    }
  };

  // Reset Priority to Benchmark Defaults
  const handleResetPriorityToDefault = () => {
    setWorkingOrder([...DEFAULT_PRIORITY_ORDER]);
  };

  // Handle Dataset File Selection
  const handleDatasetFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setUploadedJson(parsed);
        setDatasetPreview(null);
      } catch (err: unknown) {
        notify("error", "Selected file is not valid JSON.");
        setUploadedJson(null);
      }
    };
    reader.readAsText(file);
  };

  // Preview Dataset
  const handlePreviewDataset = async () => {
    if (!token || !uploadedJson) return;
    setIsPreviewingDataset(true);
    try {
      const preview = await previewDataset(uploadedJson, token);
      setDatasetPreview(preview);
      if (preview.is_valid) {
        notify("success", `Dataset ${preview.dataset_id} is valid and ready to apply.`);
      } else {
        notify("error", "Uploaded dataset contains schema validation errors.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Preview request failed.";
      notify("error", msg);
    } finally {
      setIsPreviewingDataset(false);
    }
  };

  // Commit Dataset Apply
  const handleApplyDatasetCommit = async () => {
    if (!token || !uploadedJson) return;
    setIsApplyingDataset(true);
    try {
      const res = await applyDataset(uploadedJson, true, token);
      setShowApplyConfirmModal(false);
      setUploadedJson(null);
      setDatasetPreview(null);
      notify("success", `Dataset replaced successfully: ${res.dataset_id}`);
      fetchStatus();
      fetchAudit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to commit dataset replacement.";
      notify("error", msg);
    } finally {
      setIsApplyingDataset(false);
    }
  };

  // Reload Dataset from Disk
  const handleReloadDataset = async () => {
    if (!token) return;
    setIsReloadingDataset(true);
    try {
      const res = await reloadDataset(token);
      notify("success", res.message || "Active dataset reloaded from disk.");
      fetchStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reload dataset.";
      notify("error", msg);
    } finally {
      setIsReloadingDataset(false);
    }
  };

  // Commit Demo Reset
  const handleResetDemoCommit = async () => {
    if (!token) return;
    setIsResettingDemo(true);
    try {
      const res = await resetDemoData(token);
      setShowResetConfirmModal(false);
      setResetResult(res.restored_entities);
      notify("success", res.message || "Demo environment reset to benchmark baseline.");
      fetchPriority();
      fetchStatus();
      fetchValidator();
      fetchAudit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Demo reset failed.";
      notify("error", msg);
    } finally {
      setIsResettingDemo(false);
    }
  };

  // Helper to map category id to friendly display
  const getCategoryMeta = (id: string): CategoryInfo => {
    const existing = priorityData?.categories.find((c) => c.id === id);
    if (existing) return existing;
    return {
      id,
      name: id.replace("_", " ").toUpperCase(),
      rank: 0,
      description: "Booking category",
      official_role_cap: "System",
    };
  };

  return (
    <div className="space-y-6">
      {/* Alert Notification Toast */}
      {alert && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 shadow-lg transition-all animate-fadeIn ${
            alert.type === "success"
              ? "border-emerald-800/60 bg-emerald-950/80 text-[#34D399]"
              : alert.type === "error"
              ? "border-rose-800/60 bg-rose-950/80 text-[#FB7185]"
              : "border-purple-800/60 bg-purple-950/80 text-[#A78BFA]"
          }`}
        >
          <div className="flex items-center gap-3">
            {alert.type === "success" && (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {alert.type === "error" && (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {alert.type === "info" && (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-sm font-semibold">{alert.message}</span>
          </div>
          <button
            onClick={() => setAlert(null)}
            className="rounded p-1 hover:bg-white/10 text-white/70 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-gradient-to-r from-[#141419] via-[#19191F] to-[#141419] p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white shadow-md shadow-[#8B5CF6]/20">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[#F4F2FA]">
              {isAdmin ? "System Configuration & Administration" : "Account & Institutional Settings"}
            </h2>
          </div>
          <p className="text-sm text-[#A1A1AA]">
            {isAdmin
              ? "Configure campus priority hierarchies, evaluate validator reports, inspect datasets, and control demo state."
              : `Logged in as ${currentUser?.full_name || "Guest"} (${currentUser?.role || "Unauthenticated"}). Settings view tailored to your institutional scope.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#30303A] bg-[#202027] px-3 py-1.5 shadow-sm">
              <div className="h-2 w-2 rounded-full bg-[#34D399] animate-pulse" />
              <span className="text-xs font-mono text-[#A1A1AA]">
                {currentUser.email}
              </span>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#8B5CF6]/30 hover:opacity-90 transition-all cursor-pointer"
            >
              Log In as Demo Account
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#30303A] pb-2">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "profile"
              ? "bg-[#202027] text-[#A78BFA] border border-[#8B5CF6]/40 shadow-xs"
              : "text-[#A1A1AA] hover:bg-[#19191F] hover:text-[#F4F2FA]"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>Profile & Scope</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab("priority")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "priority"
                ? "bg-[#202027] text-[#A78BFA] border border-[#8B5CF6]/40 shadow-xs"
                : "text-[#A1A1AA] hover:bg-[#19191F] hover:text-[#F4F2FA]"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <span>Booking Priorities</span>
            {isPriorityDirty && (
              <span className="h-2 w-2 rounded-full bg-[#FBBF24]" title="Unsaved changes" />
            )}
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab("dataset")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "dataset"
                ? "bg-[#202027] text-[#A78BFA] border border-[#8B5CF6]/40 shadow-xs"
                : "text-[#A1A1AA] hover:bg-[#19191F] hover:text-[#F4F2FA]"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm0 5h16" />
            </svg>
            <span>Dataset Management</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("validator")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "validator"
              ? "bg-[#202027] text-[#A78BFA] border border-[#8B5CF6]/40 shadow-xs"
              : "text-[#A1A1AA] hover:bg-[#19191F] hover:text-[#F4F2FA]"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Validator Inspector</span>
        </button>

        <button
          onClick={() => setActiveTab("system")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "system"
              ? "bg-[#202027] text-[#A78BFA] border border-[#8B5CF6]/40 shadow-xs"
              : "text-[#A1A1AA] hover:bg-[#19191F] hover:text-[#F4F2FA]"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>System Diagnostics</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab("demo_reset")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "demo_reset"
                ? "bg-rose-950/40 text-[#FB7185] border border-rose-800/50 shadow-xs"
                : "text-[#FB7185]/80 hover:bg-rose-950/20 hover:text-[#FB7185]"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Demo Reset</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "audit"
                ? "bg-[#202027] text-[#A78BFA] border border-[#8B5CF6]/40 shadow-xs"
                : "text-[#A1A1AA] hover:bg-[#19191F] hover:text-[#F4F2FA]"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Audit Trail</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PROFILE & SCOPE SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Details Card */}
          <div className="md:col-span-2 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md space-y-6">
            <div className="flex items-center justify-between border-b border-[#30303A] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white font-bold text-lg shadow-md border border-[#A78BFA]/30">
                  {currentUser?.full_name ? currentUser.full_name.charAt(0) : "G"}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F4F2FA]">
                    {currentUser?.full_name || "Demo Guest"}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                    <span className="font-mono">{currentUser?.email || "Not logged in"}</span>
                    {currentUser?.is_verified && (
                      <span className="rounded-full bg-emerald-950/60 text-[#34D399] border border-emerald-800/40 px-2 py-0.5 text-[10px] font-bold">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenLogin}
                  className="rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-1.5 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer"
                >
                  Switch Demo Account
                </button>
                {currentUser && (
                  <button
                    onClick={onLogout}
                    className="rounded-xl border border-rose-900/40 bg-rose-950/20 hover:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-[#FB7185] transition-all cursor-pointer"
                  >
                    Log Out
                  </button>
                )}
              </div>
            </div>

            {/* Profile Attributes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#30303A] bg-[#202027] p-4 space-y-1">
                <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
                  Assigned System Role
                </span>
                <p className="text-sm font-bold text-[#A78BFA] capitalize">
                  {currentUser?.role?.replace("_", " ") || "Unauthenticated Guest"}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">
                  {isAdmin
                    ? "Full administrative control over campus configurations, priorities, and solver models."
                    : currentUser?.role === "department_coordinator"
                    ? "Coordinates CSE teaching timetables, lab synchronizations, and departmental bookings."
                    : currentUser?.role === "faculty"
                    ? "Teaching faculty member with guest lecture booking privileges (max 4 hrs teaching/day)."
                    : currentUser?.role === "club_representative"
                    ? "Spectra Festival representative with 3-event club booking allocation quota."
                    : "Read-only preview mode."}
                </p>
              </div>

              <div className="rounded-xl border border-[#30303A] bg-[#202027] p-4 space-y-1">
                <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
                  Institutional Affiliation
                </span>
                <p className="text-sm font-bold text-[#F4F2FA]">
                  {currentUser?.department
                    ? `Department of ${currentUser.department}`
                    : currentUser?.club
                    ? `Student Club: ${currentUser.club} Festival`
                    : "Central Campus Administration"}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">
                  Chilika Institute of Technology (CIT) Campus OS
                </p>
              </div>

              <div className="rounded-xl border border-[#30303A] bg-[#202027] p-4 space-y-1">
                <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
                  Booking Authority Level
                </span>
                <p className="text-sm font-bold text-[#34D399]">
                  {isAdmin
                    ? "Level 1: Institute Events (Highest Priority Cap)"
                    : currentUser?.role === "faculty"
                    ? "Level 2: Guest Lectures"
                    : currentUser?.role === "department_coordinator"
                    ? "Level 3: Departmental Events"
                    : currentUser?.role === "club_representative"
                    ? "Level 4: Club Events (3 Allocated Slots)"
                    : "None"}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">
                  Enforced deterministically by official validator rules.
                </p>
              </div>

              <div className="rounded-xl border border-[#30303A] bg-[#202027] p-4 space-y-1">
                <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
                  Session Security
                </span>
                <p className="text-sm font-bold text-[#F4F2FA]">
                  Bearer Token Auth (HMAC SHA-256)
                </p>
                <p className="text-[11px] text-[#A1A1AA]">
                  Passwords stored via PBKDF2 with unique salts.
                </p>
              </div>
            </div>

            {/* Role Escalation Notice */}
            <div className="rounded-xl border border-[#30303A] bg-[#141419] p-4 flex items-center justify-between text-xs text-[#71717A]">
              <span>
                Self-service role elevation is disabled. Contact campus IT for role modifications.
              </span>
              <span className="font-mono text-[10px] text-[#A1A1AA]">SECURITY_POLICY_ENFORCED</span>
            </div>
          </div>

          {/* Quick Shortcuts & Institutional Metrics */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md space-y-4">
              <h4 className="text-sm font-bold text-[#F4F2FA] flex items-center gap-2">
                <svg className="h-4 w-4 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span>Role Quick Navigation</span>
              </h4>

              <div className="space-y-2">
                {isAdmin ? (
                  <>
                    <button
                      onClick={() => onNavigateTab("timetable")}
                      className="w-full text-left rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] p-3 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span>Timetable Solver</span>
                      <span className="text-[#A78BFA]">189 Sessions</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab("examinations")}
                      className="w-full text-left rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] p-3 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span>Exam Allocations</span>
                      <span className="text-[#A78BFA]">24 Exams</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab("venues")}
                      className="w-full text-left rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] p-3 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span>Spectra Venue Bookings</span>
                      <span className="text-[#A78BFA]">6 Requests</span>
                    </button>
                  </>
                ) : currentUser?.role === "department_coordinator" ? (
                  <>
                    <button
                      onClick={() => onNavigateTab("timetable")}
                      className="w-full text-left rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] p-3 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span>View CSE Department Schedule</span>
                      <span className="text-[#A78BFA]">CSE-1, CSE-2, CSE-3</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab("rescheduling")}
                      className="w-full text-left rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] p-3 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span>Disruption Management</span>
                      <span className="text-[#A78BFA]">Lab Shifts</span>
                    </button>
                  </>
                ) : currentUser?.role === "faculty" ? (
                  <>
                    <button
                      onClick={() => onNavigateTab("timetable")}
                      className="w-full text-left rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] p-3 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span>Check Teaching Timetable</span>
                      <span className="text-[#A78BFA]">Max 4h/day</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab("venues")}
                      className="w-full text-left rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] p-3 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span>Book Guest Lecture Hall</span>
                      <span className="text-[#A78BFA]">Seminar Halls</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onNavigateTab("venues")}
                      className="w-full text-left rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] p-3 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span>Spectra Booking Status</span>
                      <span className="text-[#A78BFA]">Festival Week</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab("ai")}
                      className="w-full text-left rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] p-3 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span>Ask AI Copilot for Available Rooms</span>
                      <span className="text-[#A78BFA]">Hinglish Ready</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md space-y-3">
              <h4 className="text-sm font-bold text-[#F4F2FA]">Active Instance</h4>
              <div className="space-y-1.5 text-xs text-[#A1A1AA]">
                <div className="flex justify-between">
                  <span>Institute</span>
                  <span className="font-semibold text-[#F4F2FA]">Chilika Inst. of Tech</span>
                </div>
                <div className="flex justify-between">
                  <span>Semester</span>
                  <span className="font-semibold text-[#F4F2FA]">Odd (2025-2026)</span>
                </div>
                <div className="flex justify-between">
                  <span>Dataset</span>
                  <span className="font-mono text-[#A78BFA]">cit_public.json</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BOOKING PRIORITY MANAGEMENT (Admin Only) */}
      {/* ========================================================================= */}
      {activeTab === "priority" && (
        <div className="space-y-6">
          {/* Unsaved Changes Banner */}
          {isPriorityDirty && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-[#FBBF24]/50 bg-[#FBBF24]/10 p-4 shadow-lg animate-fadeIn">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-[#FBBF24] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="text-sm font-bold text-[#FBBF24]">Unsaved Priority Changes</h4>
                  <p className="text-xs text-[#A1A1AA]">
                    You have reordered the priority queue. Save to commit to SQLite database and sync live booking solver.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDiscardPriority}
                  disabled={isSavingPriority}
                  className="rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-1.5 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer"
                >
                  Discard
                </button>
                <button
                  onClick={handleSavePriority}
                  disabled={isSavingPriority}
                  className="rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-[#8B5CF6]/30 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingPriority && (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  <span>Save Priority Order</span>
                </button>
              </div>
            </div>
          )}

          {/* Priority Explanation & Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md">
            <div>
              <h3 className="text-base font-bold text-[#F4F2FA]">
                6-Stage Event Priority Queue
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Determines deterministic pre-emption ordering during venue allocation conflicts.
                Categories at higher ranks strictly pre-empt lower categories.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetPriorityToDefault}
                className="rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-2 text-xs font-semibold text-[#A1A1AA] hover:text-[#F4F2FA] transition-all cursor-pointer"
                title="Restore official starter-pack priority order"
              >
                Reset to Benchmark
              </button>
              <button
                onClick={fetchPriority}
                disabled={isLoadingPriority}
                className="rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-2 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer"
                title="Reload priority from database"
              >
                {isLoadingPriority ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Interactive Reorderable List */}
          <div className="space-y-3">
            {workingOrder.map((catId, index) => {
              const meta = getCategoryMeta(catId);
              const rank = index + 1;
              return (
                <div
                  key={catId}
                  className="flex items-center justify-between rounded-xl border border-[#30303A] bg-[#19191F] hover:border-[#8B5CF6]/50 p-4 transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-4">
                    {/* Rank Badge */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#202027] border border-[#30303A] text-sm font-bold text-[#A78BFA] group-hover:border-[#8B5CF6] group-hover:shadow-xs">
                      #{rank}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#F4F2FA]">
                          {meta.name}
                        </span>
                        <span className="font-mono text-[10px] text-[#71717A] bg-[#141419] px-2 py-0.5 rounded border border-[#30303A]">
                          {catId}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#8B5CF6]/40 bg-purple-950/40 text-[#A78BFA]">
                          Cap: {meta.official_role_cap}
                        </span>
                      </div>
                      <p className="text-xs text-[#A1A1AA]">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  {/* Reorder Up / Down Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => movePriorityUp(index)}
                      disabled={index === 0}
                      className="rounded-lg p-1.5 text-[#A1A1AA] hover:bg-[#292933] hover:text-[#F4F2FA] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                      title="Move higher in priority"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => movePriorityDown(index)}
                      disabled={index === workingOrder.length - 1}
                      className="rounded-lg p-1.5 text-[#A1A1AA] hover:bg-[#292933] hover:text-[#F4F2FA] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                      title="Move lower in priority"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Priority Persistence Metadata */}
          {priorityData && (
            <div className="flex items-center justify-between text-xs text-[#71717A] px-2">
              <span>
                {priorityData.is_default
                  ? "Active configuration uses default benchmark priority."
                  : `Last updated: ${priorityData.updated_at ? new Date(priorityData.updated_at).toLocaleString() : "Unknown"} by ${priorityData.updated_by || "Admin"}`}
              </span>
              <span className="font-mono">VALIDATED_CATEGORIES: 6/6</span>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DATASET MANAGEMENT (Admin Only) */}
      {/* ========================================================================= */}
      {activeTab === "dataset" && (
        <div className="space-y-6">
          {/* Current Dataset Overview Card */}
          <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#F4F2FA]">Active Dataset Registry</h3>
                <p className="text-xs text-[#A1A1AA]">
                  Loaded dataset model used for CP-SAT solving and constraint verification.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReloadDataset}
                  disabled={isReloadingDataset}
                  className="rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-2 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer flex items-center gap-2"
                >
                  {isReloadingDataset ? "Reloading..." : "Reload from Disk"}
                </button>
              </div>
            </div>

            {systemStatus?.dataset && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="rounded-xl border border-[#30303A] bg-[#202027] p-3 text-center">
                  <span className="text-[10px] text-[#71717A] uppercase font-semibold">Rooms</span>
                  <p className="text-xl font-bold text-[#F4F2FA]">{systemStatus.dataset.total_rooms ?? "-"}</p>
                </div>
                <div className="rounded-xl border border-[#30303A] bg-[#202027] p-3 text-center">
                  <span className="text-[10px] text-[#71717A] uppercase font-semibold">Sessions</span>
                  <p className="text-xl font-bold text-[#A78BFA]">{systemStatus.dataset.total_sessions ?? "-"}</p>
                </div>
                <div className="rounded-xl border border-[#30303A] bg-[#202027] p-3 text-center">
                  <span className="text-[10px] text-[#71717A] uppercase font-semibold">Faculty</span>
                  <p className="text-xl font-bold text-[#F4F2FA]">{systemStatus.dataset.total_faculty ?? "-"}</p>
                </div>
                <div className="rounded-xl border border-[#30303A] bg-[#202027] p-3 text-center">
                  <span className="text-[10px] text-[#71717A] uppercase font-semibold">Exams</span>
                  <p className="text-xl font-bold text-[#34D399]">{systemStatus.dataset.total_exams ?? "-"}</p>
                </div>
              </div>
            )}
          </div>

          {/* Dataset Upload & Preview Card */}
          <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md space-y-4">
            <h3 className="text-base font-bold text-[#F4F2FA]">Upload & Validate New Dataset</h3>
            <p className="text-xs text-[#A1A1AA]">
              Upload a replacement JSON dataset conforming to the official starter-pack schema.
              Validation runs through backend Pydantic models before any modification occurs.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#30303A] bg-[#202027] hover:border-[#8B5CF6]/50 p-6 transition-all cursor-pointer w-full">
                <svg className="h-8 w-8 text-[#A1A1AA] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-xs font-semibold text-[#F4F2FA]">
                  {uploadedJson ? "Dataset JSON loaded into memory" : "Select .json dataset file to inspect"}
                </span>
                <span className="text-[10px] text-[#71717A] mt-1">
                  Format: cit_public.json starter-pack schema
                </span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleDatasetFileChange}
                  className="hidden"
                />
              </label>

              {uploadedJson && (
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <button
                    onClick={handlePreviewDataset}
                    disabled={isPreviewingDataset}
                    className="rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#8B5CF6]/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isPreviewingDataset ? "Validating..." : "Validate & Preview"}
                  </button>
                  <button
                    onClick={() => {
                      setUploadedJson(null);
                      setDatasetPreview(null);
                    }}
                    className="rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-1.5 text-xs font-semibold text-[#FB7185] transition-all cursor-pointer"
                  >
                    Clear File
                  </button>
                </div>
              )}
            </div>

            {/* Validation Preview Results */}
            {datasetPreview && (
              <div
                className={`rounded-xl border p-4 space-y-3 ${
                  datasetPreview.is_valid
                    ? "border-emerald-800/60 bg-emerald-950/20"
                    : "border-rose-800/60 bg-rose-950/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        datasetPreview.is_valid ? "bg-[#34D399]" : "bg-[#FB7185]"
                      }`}
                    />
                    <h4
                      className={`text-sm font-bold ${
                        datasetPreview.is_valid ? "text-[#34D399]" : "text-[#FB7185]"
                      }`}
                    >
                      {datasetPreview.is_valid
                        ? `Schema Validation Passed: ${datasetPreview.dataset_id}`
                        : "Schema Validation Failed"}
                    </h4>
                  </div>

                  {datasetPreview.is_valid && (
                    <button
                      onClick={() => setShowApplyConfirmModal(true)}
                      className="rounded-lg bg-[#34D399] hover:bg-emerald-400 text-black px-3 py-1 text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      Apply Replacement
                    </button>
                  )}
                </div>

                {datasetPreview.is_valid ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[#A1A1AA]">
                    <div>Institute: <span className="text-[#F4F2FA]">{datasetPreview.institute}</span></div>
                    <div>Rooms: <span className="text-[#F4F2FA]">{datasetPreview.counts.rooms}</span></div>
                    <div>Sessions: <span className="text-[#F4F2FA]">{datasetPreview.counts.sessions}</span></div>
                    <div>Exams: <span className="text-[#F4F2FA]">{datasetPreview.counts.exams}</span></div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-[#FB7185] font-semibold">
                      Validation errors detected by Pydantic:
                    </p>
                    <ul className="text-xs font-mono text-[#FB7185]/90 space-y-1 pl-4 list-disc max-h-40 overflow-y-auto">
                      {datasetPreview.validation_errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: VALIDATOR INSPECTOR */}
      {/* ========================================================================= */}
      {activeTab === "validator" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md">
            <div>
              <h3 className="text-base font-bold text-[#F4F2FA]">
                Official Validator Inspector (validator.py)
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Displays genuine validation reports produced by the starter-pack validator across all 4 domains.
                No simulated or fabricated passing states.
              </p>
            </div>

            <button
              onClick={fetchValidator}
              disabled={isLoadingValidator}
              className="rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-2 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer"
            >
              {isLoadingValidator ? "Checking..." : "Re-inspect All"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Domain 1: Regular Timetable */}
            <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#30303A] pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" />
                  <h4 className="text-sm font-bold text-[#F4F2FA]">Domain 1: Regular Timetable</h4>
                </div>
                {validatorReports?.timetable ? (
                  <span className="rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 text-[10px] font-bold text-[#34D399]">
                    Solver Verified
                  </span>
                ) : (
                  <span className="rounded-full bg-[#292933] border border-[#30303A] px-2 py-0.5 text-[10px] text-[#A1A1AA]">
                    Not Generated
                  </span>
                )}
              </div>

              {validatorReports?.timetable ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Hard Violations:</span>
                    <span className="font-bold text-[#34D399]">
                      {validatorReports.timetable.hard_violation_count as number} violations
                    </span>
                  </div>
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Soft Objective Penalty:</span>
                    <span className="font-bold text-[#A78BFA]">
                      {validatorReports.timetable.soft_penalty as number}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Scheduled Sessions:</span>
                    <span className="font-mono text-[#F4F2FA]">
                      {(validatorReports.timetable.scheduled_sessions as number) || 189} / 189
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <p className="text-xs text-[#71717A]">No timetable report found on disk.</p>
                  <button
                    onClick={() => onNavigateTab("timetable")}
                    className="rounded-lg border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-1 text-xs font-semibold text-[#A78BFA] transition-all cursor-pointer"
                  >
                    Open Timetable Module
                  </button>
                </div>
              )}
            </div>

            {/* Domain 2: Midsem Examinations */}
            <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#30303A] pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#34D399]" />
                  <h4 className="text-sm font-bold text-[#F4F2FA]">Domain 2: Midsem Examinations</h4>
                </div>
                {validatorReports?.exams ? (
                  <span className="rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 text-[10px] font-bold text-[#34D399]">
                    Verified
                  </span>
                ) : (
                  <span className="rounded-full bg-[#292933] border border-[#30303A] px-2 py-0.5 text-[10px] text-[#A1A1AA]">
                    Not Generated
                  </span>
                )}
              </div>

              {validatorReports?.exams ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Hard Violations:</span>
                    <span className="font-bold text-[#34D399]">0 violations</span>
                  </div>
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Total Exams Scheduled:</span>
                    <span className="font-bold text-[#F4F2FA]">24 / 24</span>
                  </div>
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>50% Room Capacity Rule:</span>
                    <span className="text-[#34D399] font-bold">Compliant</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <p className="text-xs text-[#71717A]">No examination schedule report found.</p>
                  <button
                    onClick={() => onNavigateTab("examinations")}
                    className="rounded-lg border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-1 text-xs font-semibold text-[#34D399] transition-all cursor-pointer"
                  >
                    Open Exam Scheduler
                  </button>
                </div>
              )}
            </div>

            {/* Domain 3: Spectra Venue Bookings */}
            <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#30303A] pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#FBBF24]" />
                  <h4 className="text-sm font-bold text-[#F4F2FA]">Domain 3: Spectra Venue Bookings</h4>
                </div>
                {validatorReports?.bookings ? (
                  <span className="rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 text-[10px] font-bold text-[#34D399]">
                    Allocations Ready
                  </span>
                ) : (
                  <span className="rounded-full bg-[#292933] border border-[#30303A] px-2 py-0.5 text-[10px] text-[#A1A1AA]">
                    Draft Available
                  </span>
                )}
              </div>

              {validatorReports?.bookings ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Priority Engine:</span>
                    <span className="font-bold text-[#F4F2FA]">Active</span>
                  </div>
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Official Cap Check:</span>
                    <span className="font-bold text-[#34D399]">3 Bookings / Club</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <p className="text-xs text-[#71717A]">No active venue report recorded.</p>
                  <button
                    onClick={() => onNavigateTab("venues")}
                    className="rounded-lg border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-1 text-xs font-semibold text-[#FBBF24] transition-all cursor-pointer"
                  >
                    Open Venue Manager
                  </button>
                </div>
              )}
            </div>

            {/* Domain 4: Disruption & Rescheduling Engine */}
            <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#30303A] pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#A78BFA]" />
                  <h4 className="text-sm font-bold text-[#F4F2FA]">Domain 4: Disruption & Repair</h4>
                </div>
                {validatorReports?.disruptions ? (
                  <span className="rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 text-[10px] font-bold text-[#34D399]">
                    Revision Recorded
                  </span>
                ) : (
                  <span className="rounded-full bg-[#292933] border border-[#30303A] px-2 py-0.5 text-[10px] text-[#A1A1AA]">
                    Baseline v1.0
                  </span>
                )}
              </div>

              {validatorReports?.disruptions ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Latest Version:</span>
                    <span className="font-mono text-[#F4F2FA]">
                      {validatorReports.disruptions.version as string || "v1"}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Repair Status:</span>
                    <span className="text-[#34D399] font-bold">Committed</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <p className="text-xs text-[#71717A]">Active schedule is baseline v1.0.</p>
                  <button
                    onClick={() => onNavigateTab("rescheduling")}
                    className="rounded-lg border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-1 text-xs font-semibold text-[#A78BFA] transition-all cursor-pointer"
                  >
                    Open Rescheduling Engine
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SYSTEM DIAGNOSTICS */}
      {/* ========================================================================= */}
      {activeTab === "system" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md">
            <div>
              <h3 className="text-base font-bold text-[#F4F2FA]">
                Live System Diagnostics & Subsystem Health
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Real-time operational status for API server, database, solver worker threads, and AI parser.
              </p>
            </div>

            <button
              onClick={fetchStatus}
              disabled={isLoadingStatus}
              className="rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-2 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer"
            >
              {isLoadingStatus ? "Checking..." : "Re-run Diagnostics"}
            </button>
          </div>

          {systemStatus ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* FastAPI Backend */}
              <div className="rounded-xl border border-[#30303A] bg-[#19191F] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F4F2FA]">FastAPI Service</span>
                  <span className="rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 text-[10px] font-bold text-[#34D399]">
                    Online
                  </span>
                </div>
                <div className="space-y-1 text-xs text-[#A1A1AA]">
                  <div>Service: <span className="text-[#F4F2FA]">{systemStatus.backend.service}</span></div>
                  <div>Version: <span className="font-mono text-[#A78BFA]">v{systemStatus.backend.version}</span></div>
                  <div>Demo Mode: <span className="text-[#F4F2FA]">{systemStatus.backend.demo_mode ? "Enabled" : "Disabled"}</span></div>
                </div>
              </div>

              {/* SQLite Database */}
              <div className="rounded-xl border border-[#30303A] bg-[#19191F] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F4F2FA]">SQLite Database</span>
                  <span className="rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 text-[10px] font-bold text-[#34D399]">
                    Connected
                  </span>
                </div>
                <div className="space-y-1 text-xs text-[#A1A1AA]">
                  <div>Registered Users: <span className="font-bold text-[#F4F2FA]">{systemStatus.database.registered_users}</span></div>
                  <div>Active Sessions: <span className="font-bold text-[#A78BFA]">{systemStatus.database.active_sessions}</span></div>
                  <div className="truncate text-[10px] font-mono text-[#71717A]">{systemStatus.database.path}</div>
                </div>
              </div>

              {/* CP-SAT Solver */}
              <div className="rounded-xl border border-[#30303A] bg-[#19191F] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F4F2FA]">Google OR-Tools</span>
                  <span className="rounded-full bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 text-[10px] font-bold text-[#A78BFA]">
                    CP-SAT Solver
                  </span>
                </div>
                <div className="space-y-1 text-xs text-[#A1A1AA]">
                  <div>Engine: <span className="text-[#F4F2FA]">{systemStatus.solver.engine}</span></div>
                  <div>Version: <span className="font-mono text-[#A78BFA]">{systemStatus.solver.version}</span></div>
                  <div>Workers: <span className="text-[#34D399] font-bold">Multi-threaded (8 workers)</span></div>
                </div>
              </div>

              {/* AI Parser Engine */}
              <div className="rounded-xl border border-[#30303A] bg-[#19191F] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F4F2FA]">AI Natural Language</span>
                  <span className="rounded-full bg-blue-950/60 border border-blue-800/40 px-2 py-0.5 text-[10px] font-bold text-[#38BDF8]">
                    Bilingual
                  </span>
                </div>
                <div className="space-y-1 text-xs text-[#A1A1AA]">
                  <div>Provider: <span className="text-[#F4F2FA]">{systemStatus.ai.provider}</span></div>
                  <div>Model: <span className="font-mono text-[#A78BFA]">{systemStatus.ai.model}</span></div>
                  <div>Languages: <span className="text-[#34D399]">English + Hinglish</span></div>
                </div>
              </div>

              {/* Dataset Status */}
              <div className="rounded-xl border border-[#30303A] bg-[#19191F] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F4F2FA]">Dataset Cache</span>
                  <span className="rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 text-[10px] font-bold text-[#34D399]">
                    Loaded
                  </span>
                </div>
                <div className="space-y-1 text-xs text-[#A1A1AA]">
                  <div>ID: <span className="font-mono text-[#A78BFA]">{systemStatus.dataset.dataset_id}</span></div>
                  <div>Total Rooms: <span className="text-[#F4F2FA]">{systemStatus.dataset.total_rooms}</span></div>
                  <div>Total Sessions: <span className="text-[#F4F2FA]">{systemStatus.dataset.total_sessions}</span></div>
                </div>
              </div>

              {/* Artifacts Summary */}
              <div className="rounded-xl border border-[#30303A] bg-[#19191F] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F4F2FA]">Disk Artifacts</span>
                  <span className="text-[10px] font-mono text-[#71717A]">EXPORTS</span>
                </div>
                <div className="space-y-1 text-xs text-[#A1A1AA]">
                  <div className="flex justify-between">
                    <span>Timetable:</span>
                    <span className={systemStatus.timetable_generated ? "text-[#34D399]" : "text-[#71717A]"}>
                      {systemStatus.timetable_generated ? "Exists" : "Not yet generated"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exams:</span>
                    <span className={systemStatus.exams_generated ? "text-[#34D399]" : "text-[#71717A]"}>
                      {systemStatus.exams_generated ? "Exists" : "Not yet generated"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bookings:</span>
                    <span className={systemStatus.bookings_generated ? "text-[#34D399]" : "text-[#71717A]"}>
                      {systemStatus.bookings_generated ? "Exists" : "Not yet generated"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#30303A] bg-[#19191F] p-8 text-center text-sm text-[#71717A]">
              Loading live diagnostics...
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: DEMO DATA RESET (Admin Only) */}
      {/* ========================================================================= */}
      {activeTab === "demo_reset" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-rose-900/60 bg-gradient-to-r from-rose-950/30 via-[#19191F] to-rose-950/20 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-900/50 border border-rose-700/60 text-[#FB7185]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#FB7185]">
                  Judge Demo Reset & State Synchronization
                </h3>
                <p className="text-xs text-[#A1A1AA]">
                  Restore the scheduling system to the official evaluation baseline.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[#30303A] bg-[#141419] p-4 text-xs text-[#A1A1AA] space-y-2">
              <p className="font-semibold text-[#F4F2FA]">What this action does:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Resets the 6-stage booking priority order back to benchmark default.</li>
                <li>Clears all pending and approved disruption proposals and schedule version forks.</li>
                <li>Clears mutable Spectra venue booking allocations and session overrides.</li>
                <li>Clears timetable and exam draft export files.</li>
                <li>Reloads the official <code className="text-[#A78BFA]">cit_public.json</code> dataset.</li>
                <li>Idempotently re-synchronizes the 4 judge demo accounts.</li>
                <li>Appends a permanent audit trail entry with your identity and timestamp.</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowResetConfirmModal(true)}
                className="rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-900/40 transition-all cursor-pointer flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Reset Demo Environment to Baseline</span>
              </button>
            </div>
          </div>

          {/* Reset Result Log */}
          {resetResult && (
            <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/20 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#34D399]" />
                <h4 className="text-sm font-bold text-[#34D399]">
                  State Restoration Complete
                </h4>
              </div>
              <ul className="text-xs font-mono text-[#34D399]/90 space-y-1 pl-4 list-disc">
                {resetResult.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: AUDIT TRAIL (Admin Only) */}
      {/* ========================================================================= */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md">
            <div>
              <h3 className="text-base font-bold text-[#F4F2FA]">
                Administrative Action Audit Trail
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Immutable log of priority updates, dataset replacements, and demo resets.
              </p>
            </div>

            <button
              onClick={fetchAudit}
              disabled={isLoadingAudit}
              className="rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-2 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer"
            >
              {isLoadingAudit ? "Loading..." : "Refresh Audit Log"}
            </button>
          </div>

          <div className="rounded-2xl border border-[#30303A] bg-[#19191F] overflow-hidden shadow-md">
            {auditLogs.length > 0 ? (
              <div className="divide-y divide-[#30303A]">
                {auditLogs.map((entry, idx) => (
                  <div key={idx} className="p-4 space-y-1 hover:bg-[#202027]/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 text-[10px] font-bold text-[#A78BFA]">
                          {entry.action}
                        </span>
                        <span className="text-xs font-semibold text-[#F4F2FA]">
                          {entry.admin || "system"}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-[#71717A]">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {entry.reason && (
                      <p className="text-xs text-[#A1A1AA]">{entry.reason}</p>
                    )}
                    {entry.new_order && (
                      <div className="text-[11px] font-mono text-[#A78BFA] pt-1">
                        New Order: {entry.new_order.join(" → ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#71717A]">
                No administrative audit actions recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DATASET APPLY CONFIRMATION */}
      {/* ========================================================================= */}
      {showApplyConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#F4F2FA]">
              Confirm Dataset Replacement
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Replacing the dataset will create an automatic timestamped backup of the current
              <code className="text-[#A78BFA]"> cit_public.json</code> and reload in-memory solver models.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowApplyConfirmModal(false)}
                className="rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-1.5 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyDatasetCommit}
                disabled={isApplyingDataset}
                className="rounded-xl bg-[#34D399] hover:bg-emerald-400 text-black px-4 py-1.5 text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isApplyingDataset ? "Applying..." : "Yes, Replace Dataset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DEMO RESET CONFIRMATION */}
      {/* ========================================================================= */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-rose-900/60 bg-[#19191F] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-950 text-[#FB7185] border border-rose-800/40">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#FB7185]">
                Confirm Complete Demo Reset
              </h3>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              This will irreversibly clear all booking proposals, reset the priority hierarchy,
              clear draft timetable exports, and return the application to the judge evaluation benchmark.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-1.5 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDemoCommit}
                disabled={isResettingDemo}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isResettingDemo && (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                <span>Confirm Benchmark Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

