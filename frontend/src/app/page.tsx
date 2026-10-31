"use client";

import React, { useCallback, useEffect, useState } from "react";
import { clearStoredAuth, getDatasetSummary, getStoredAuth, logoutUser } from "@/lib/api";
import type { DatasetSummary, User } from "@/lib/types";
import { Sidebar, type NavTabId } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { StatCard } from "@/components/StatCard";
import { ModulesOverview } from "@/components/ModulesOverview";
import { ComingSoonView } from "@/components/ComingSoonView";
import { ErrorBanner } from "@/components/ErrorBanner";
import { TimetableManagementView } from "@/components/TimetableManagementView";
import { ExaminationsManagementView } from "@/components/ExaminationsManagementView";
import { VenuesManagementView } from "@/components/VenuesManagementView";
import { ReschedulingManagementView } from "@/components/ReschedulingManagementView";
import { AIAssistantView } from "@/components/AIAssistantView";
import { LoginModal } from "@/components/LoginModal";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<NavTabId>("overview");
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Load persisted user session on mount
  useEffect(() => {
    const stored = getStoredAuth();
    if (stored.token && stored.user) {
      setAuthToken(stored.token);
      setCurrentUser(stored.user);
    } else {
      // Default initial view for judges: Admin
      const defaultAdmin: User = {
        id: "usr_demo_admin",
        email: "admin@cit-demo.test",
        full_name: "CIT Campus Administrator",
        role: "admin",
        department: null,
        club: null,
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString(),
      };
      setCurrentUser(defaultAdmin);
    }
  }, []);

  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
  };

  const handleLogout = async () => {
    if (authToken) {
      await logoutUser(authToken);
    }
    clearStoredAuth();
    setCurrentUser(null);
    setAuthToken(null);
  };


  const fetchSummary = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await getDatasetSummary();
      setSummary(data);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to connect to CIT backend service.";
      setError(message);
      setIsConnected(false);
      setSummary(null);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const activeTabLabel =
    activeTab === "overview"
      ? "Overview"
      : activeTab === "timetable"
      ? "Timetable"
      : activeTab === "examinations"
      ? "Examinations"
      : activeTab === "venues"
      ? "Venue Bookings"
      : activeTab === "rescheduling"
      ? "Rescheduling"
      : activeTab === "ai"
      ? "AI Assistant"
      : "Settings";

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Dark Navy Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          onToggleMobile={() => setMobileOpen(true)}
          datasetId={summary?.dataset_id ?? "cit-public-v1"}
          isConnected={isConnected}
          isRefreshing={isRefreshing}
          onRefresh={() => fetchSummary(true)}
          activeTabLabel={activeTabLabel}
          currentUser={currentUser}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === "timetable" ? (
            <TimetableManagementView />
          ) : activeTab === "examinations" ? (
            <ExaminationsManagementView />
          ) : activeTab === "venues" ? (
            <VenuesManagementView />
          ) : activeTab === "rescheduling" ? (
            <ReschedulingManagementView />
          ) : activeTab === "ai" ? (
            <AIAssistantView authenticatedRole={currentUser?.role} />
          ) : activeTab !== "overview" ? (
            <ComingSoonView
              tabId={activeTab}
              onBackToOverview={() => setActiveTab("overview")}
            />
          ) : (
            <>
              {/* Error State Banner */}
              {error && (
                <ErrorBanner
                  errorMessage={error}
                  onRetry={() => fetchSummary(true)}
                  isRetrying={isRefreshing || loading}
                />
              )}

              {/* Role-Specific Tailored Dashboard Banner */}
              {currentUser && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
                  <div className="flex items-start gap-3.5">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-xs ${
                      currentUser.role === "admin"
                        ? "bg-purple-600"
                        : currentUser.role === "department_coordinator"
                        ? "bg-blue-600"
                        : currentUser.role === "faculty"
                        ? "bg-emerald-600"
                        : "bg-amber-600"
                    }`}>
                      {currentUser.role === "admin"
                        ? "AD"
                        : currentUser.role === "department_coordinator"
                        ? "DC"
                        : currentUser.role === "faculty"
                        ? "FC"
                        : "CR"}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {currentUser.full_name}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          currentUser.role === "admin"
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : currentUser.role === "department_coordinator"
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : currentUser.role === "faculty"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-amber-100 text-amber-800 border-amber-200"
                        }`}>
                          {currentUser.role.replace("_", " ")}
                        </span>
                        {currentUser.department && (
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            Dept: {currentUser.department}
                          </span>
                        )}
                        {currentUser.club && (
                          <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            Club: {currentUser.club}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                        {currentUser.role === "admin" &&
                          "Administrator Authority: Master oversight of all 189 sessions, 27 venues, 41 midsem exams, and final disruption commits."}
                        {currentUser.role === "department_coordinator" &&
                          "CSE Department Coordinator Authority: Oversight of Computer Science course sessions, faculty teaching loads, and departmental venue requests."}
                        {currentUser.role === "faculty" &&
                          "Faculty Member Scope: View assigned teaching periods, protected lunch hours (P5–P6), midsem invigilation allocations, and request guest lectures."}
                        {currentUser.role === "club_representative" &&
                          "Spectra Club Representative Scope: Request festival venues for Spectra Week (P10–P13) subject to the strict 3-event club quota cap."}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-2xs"
                  >
                    <span>Switch Judge Account</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </button>
                </div>
              )}


              {/* Institution Hero Card */}
              <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-md">
                <div className="relative z-10 max-w-3xl space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 border border-blue-400/30 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur-xs">
                    <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                    <span>Official Scheduling Dataset</span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {summary?.institute ?? "Chilika Institute of Technology"}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                    Built for constraint-based campus scheduling, examination allocation and venue management. Scheduling and validation engines are currently under development.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                    <span className="rounded-lg bg-white/10 px-3 py-1 font-mono text-slate-200 border border-white/10">
                      Academic Year 2026-27
                    </span>
                    <span className="rounded-lg bg-white/10 px-3 py-1 font-mono text-slate-200 border border-white/10">
                      MON – FRI Teaching Week
                    </span>
                    <span className="rounded-lg bg-white/10 px-3 py-1 font-mono text-slate-200 border border-white/10">
                      Spectra '27 (Week 7)
                    </span>
                  </div>
                </div>

                {/* Decorative background watermark */}
                <div className="pointer-events-none absolute -right-12 -bottom-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
              </div>

              {/* Primary 6 Statistic Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Core Campus Entities
                  </h3>
                  <span className="text-xs text-slate-600">
                    Live counts from <code className="font-mono text-slate-600">cit_public.json</code>
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* 189 Sessions */}
                  <StatCard
                    title="Timetable Sessions"
                    value={summary?.total_sessions}
                    badge="243 hrs/wk"
                    description="Lecture, tutorial and 3-hour lab blocks to be scheduled into 9 teaching periods without conflicts."
                    theme="blue"
                    loading={loading}
                    icon={({ className }) => (
                      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  />

                  {/* 27 Rooms */}
                  <StatCard
                    title="Campus Rooms"
                    value={summary?.total_rooms}
                    badge="10 Types"
                    description="Classrooms, Lecture Halls, Auditorium (500 cap), Seminar Halls, OAT, and 7 specialized laboratories."
                    theme="emerald"
                    loading={loading}
                    icon={({ className }) => (
                      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    )}
                  />

                  {/* 40 Faculty */}
                  <StatCard
                    title="Faculty Members"
                    value={summary?.total_faculty}
                    badge="5 Depts"
                    description="Instructors with daily teaching limits (max hours/day), hard unavailable slots, and soft preference windows."
                    theme="indigo"
                    loading={loading}
                    icon={({ className }) => (
                      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      </svg>
                    )}
                  />

                  {/* 14 Student Groups */}
                  <StatCard
                    title="Student Groups"
                    value={summary?.total_student_groups}
                    badge="Y1 – Y3"
                    description="Four Year 1 cohorts (A-D) and ten branch sections across CSE, ECE, EEE, MECH, and CIVIL."
                    theme="amber"
                    loading={loading}
                    icon={({ className }) => (
                      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    )}
                  />

                  {/* 41 Examinations */}
                  <StatCard
                    title="Examinations"
                    value={summary?.total_exams}
                    badge="AM & PM"
                    description="Midsem examinations scheduled MON-SAT with halved (50%) seating capacity across partitioned venues."
                    theme="purple"
                    loading={loading}
                    icon={({ className }) => (
                      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    )}
                  />

                  {/* 25 Booking Requests */}
                  <StatCard
                    title="Fest Bookings"
                    value={summary?.total_booking_requests}
                    badge="Spectra '27"
                    description="Event venue requests during Week 7 with role category caps (Admin, Faculty, Dept, Club) and priority queue."
                    theme="teal"
                    loading={loading}
                    icon={({ className }) => (
                      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    )}
                  />
                </div>
              </div>

              {/* Secondary Dataset Metrics Bar */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Additional Dataset Specifications
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Ancillary entities loaded from the official CIT benchmark
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[10px] font-medium text-slate-500 uppercase">Courses</div>
                      <div className="mt-0.5 text-base font-bold text-slate-900 font-mono">
                        {summary?.total_courses ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[10px] font-medium text-slate-500 uppercase">Room Outages</div>
                      <div className="mt-0.5 text-base font-bold text-slate-900 font-mono">
                        {summary?.total_room_unavailability ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[10px] font-medium text-slate-500 uppercase">Cancellations</div>
                      <div className="mt-0.5 text-base font-bold text-slate-900 font-mono">
                        {summary?.total_cancellations ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[10px] font-medium text-slate-500 uppercase">Teaching Periods</div>
                      <div className="mt-0.5 text-base font-bold text-slate-900 font-mono">
                        9 / day
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Platform Modules Overview */}
              <ModulesOverview />
            </>
          )}
        </main>
      </div>

      {/* Judge Demo Login & Switcher Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    </div>
  );
}

