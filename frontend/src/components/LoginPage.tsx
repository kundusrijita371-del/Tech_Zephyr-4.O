"use client";

import React, { useState } from "react";
import Image from "next/image";
import { loginUser, registerUser, setStoredAuth } from "@/lib/api";
import type { User } from "@/lib/types";

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  onContinueAsGuest?: () => void;
}

interface DemoSection {
  id: string;
  role: string;
  roleBadge: string;
  badgeStyle: string;
  title: string;
  subtitle: string;
  email: string;
  password: string;
  description: string;
  keyCapabilities: string[];
  icon: (props: { className?: string }) => React.JSX.Element;
}

const DEMO_SECTIONS: DemoSection[] = [
  {
    id: "admin",
    role: "admin",
    roleBadge: "GLOBAL ADMIN",
    badgeStyle: "bg-purple-950/70 text-purple-300 border-purple-500/40",
    title: "Campus Administrator",
    subtitle: "System-Wide Authority",
    email: "admin@cit-demo.test",
    password: "CIT_Admin@2026!",
    description: "Full oversight over university timetable generation, midsem exam room allocation, venue conflict resolution, and global system configuration.",
    keyCapabilities: [
      "189-Session CP-SAT Timetable Engine",
      "50% Capacity Exam Scheduler",
      "Priority Event Approval & Overrides",
      "Disruption Repair Engine & Audit Trail",
    ],
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    id: "coordinator",
    role: "department_coordinator",
    roleBadge: "CSE COORDINATOR",
    badgeStyle: "bg-blue-950/70 text-blue-300 border-blue-500/40",
    title: "Department Coordinator",
    subtitle: "Computer Science & Engineering",
    email: "coordinator@cit-demo.test",
    password: "CIT_Coord@2026!",
    description: "Coordinates departmental course schedules, 3-hour synchronized lab blocks, student cohorts (CSE-1, CSE-2, CSE-3), and lab venue approvals.",
    keyCapabilities: [
      "Departmental Timetable Synchronization",
      "P2/P6 Lab Block Alignment",
      "Faculty Teaching Workload Tracking",
      "Department Venue & Workshop Approvals",
    ],
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: "faculty",
    role: "faculty",
    roleBadge: "CSE FACULTY (F01)",
    badgeStyle: "bg-emerald-950/70 text-emerald-300 border-emerald-500/40",
    title: "Dr. Ananya Mishra",
    subtitle: "Senior Faculty, CSE Department",
    email: "faculty@cit-demo.test",
    password: "CIT_Faculty@2026!",
    description: "Personal lecture and synchronized lab teaching schedule strictly complying with the official 4-hours-per-day max workload constraint (Rule H12).",
    keyCapabilities: [
      "Personal 7-Session Weekly Timetable",
      "Rule H12 Max 4h/Day Load Verification",
      "Weekly Teaching Availability Grid",
      "Guest Lecture Seminar Venue Requests",
    ],
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
      </svg>
    ),
  },
  {
    id: "spectra",
    role: "club_representative",
    roleBadge: "SPECTRA FESTIVAL",
    badgeStyle: "bg-amber-950/70 text-amber-300 border-amber-500/40",
    title: "Spectra Club Representative",
    subtitle: "Annual Tech & Cultural Festival",
    email: "spectra@cit-demo.test",
    password: "CIT_Spectra@2026!",
    description: "Submits and manages festival venue bookings for Spectra Week (P10–P13 evening slots), tracked under the strict 3-event club cap (Rule B3).",
    keyCapabilities: [
      "New Venue Request CP-SAT Compatibility Check",
      "Spectra Week P10–P13 Slot Allocations",
      "Rule B3 3-Event Evening Cap Tracking",
      "Priority B1 Event Displacement Notifications",
    ],
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

export function LoginPage({ onLoginSuccess, onContinueAsGuest }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<"roles" | "signin" | "signup">("roles");

  // Sign In states
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up states (Glassmorphism form)
  const [signUpFullName, setSignUpFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpRole, setSignUpRole] = useState("faculty");
  const [signUpDepartment, setSignUpDepartment] = useState("CSE");
  const [signUpClub, setSignUpClub] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // Status & loading states
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1-Click Demo Login Handler
  const handleDemoLogin = async (section: DemoSection) => {
    setLoadingAction(section.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const data = await loginUser(section.email, section.password);
      setStoredAuth(data.access_token, data.user);
      onLoginSuccess(data.user, data.access_token);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Authentication failed. Ensure backend service is online.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Sign In submit handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail || !signInPassword) {
      setErrorMessage("Please enter both email and password.");
      return;
    }
    setLoadingAction("signin");
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const data = await loginUser(signInEmail.trim(), signInPassword);
      setStoredAuth(data.access_token, data.user);
      onLoginSuccess(data.user, data.access_token);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Sign Up submit handler (Glassmorphism block)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpFullName.trim() || !signUpEmail.trim() || !signUpPassword) {
      setErrorMessage("Please fill out all required fields.");
      return;
    }
    if (signUpPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }
    if (signUpPassword !== signUpConfirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoadingAction("signup");
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const data = await registerUser({
        email: signUpEmail.trim().toLowerCase(),
        password: signUpPassword,
        full_name: signUpFullName.trim(),
        role: signUpRole,
        department: signUpRole === "club_representative" ? null : signUpDepartment.trim() || "CSE",
        club: signUpRole === "club_representative" ? signUpClub.trim() || "Spectra" : null,
      });

      setStoredAuth(data.access_token, data.user);
      setSuccessMessage("Account created successfully! Redirecting...");
      setTimeout(() => {
        onLoginSuccess(data.user, data.access_token);
      }, 500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Registration failed. Email may already be in use.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden text-[#F4F2FA] font-sans antialiased selection:bg-[#8B5CF6]/30 selection:text-white">
      {/* Background Wallpaper with Cinematic Dusk Campus Image */}
      <div className="fixed inset-0 -z-20 overflow-hidden">
        <Image
          src="/cit_campus_wallpaper.jpg"
          alt="Chilika Institute of Technology Campus"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center filter brightness-[0.75] contrast-[1.05]"
        />
        {/* Dark Dusk & Obsidian Lavender Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-[#101014]/65 to-[#101014]/80" />
        <div className="absolute inset-0 bg-radial-[ellipse_at_top] from-[#8B5CF6]/15 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Top Navbar Header */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-5 flex items-center justify-between border-b border-white/10 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white font-black text-sm shadow-lg shadow-purple-900/40 border border-white/20">
            CIT
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">CIT CAMPUS OS</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-purple-200">
                v2026.1
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 hidden sm:block">
              Chilika Institute of Technology • Automated Scheduling & Venue Management
            </p>
          </div>
        </div>

        {/* Quick Nav Controls */}
        <div className="flex items-center gap-2">
          {onContinueAsGuest && (
            <button
              onClick={onContinueAsGuest}
              className="px-3.5 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-200 backdrop-blur-md transition-all cursor-pointer"
            >
              Continue to Dashboard →
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-7xl mx-auto w-full">
        {/* Hero Title & Value Proposition */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10 space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#C4B5FD] backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-[#34D399] animate-pulse" />
            Hackathon Judge Evaluation Portal
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
            Chilika Institute of Technology
          </h1>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl mx-auto leading-relaxed drop-shadow-xs">
            Authenticate into any of the 4 specialized roles below to evaluate the CP-SAT timetable solver, midsem examination hall allocator, Spectra festival bookings, and intelligent rescheduling engine.
          </p>

          {/* Navigation Mode Segmented Controller */}
          <div className="pt-3 flex justify-center">
            <div className="inline-flex p-1 rounded-2xl bg-black/40 border border-white/15 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => { setActiveTab("roles"); setErrorMessage(null); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "roles"
                    ? "bg-[#8B5CF6] text-white shadow-lg shadow-purple-900/40"
                    : "text-zinc-300 hover:text-white"
                }`}
              >
                4 Role Sections (1-Click)
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("signin"); setErrorMessage(null); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "signin"
                    ? "bg-[#8B5CF6] text-white shadow-lg shadow-purple-900/40"
                    : "text-zinc-300 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("signup"); setErrorMessage(null); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "signup"
                    ? "bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-lg shadow-purple-900/40"
                    : "text-zinc-300 hover:text-white"
                }`}
              >
                Sign Up (Glassmorphism)
              </button>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="max-w-xl mx-auto mb-6 w-full rounded-2xl border border-rose-500/50 bg-rose-950/70 backdrop-blur-md p-4 text-xs text-[#FB7185] flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-rose-300 hover:text-white underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Success Banner */}
        {successMessage && (
          <div className="max-w-xl mx-auto mb-6 w-full rounded-2xl border border-emerald-500/50 bg-emerald-950/70 backdrop-blur-md p-4 text-xs text-[#34D399] flex items-center gap-2 shadow-xl">
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: THE 4 ROLE SECTIONS AS PREVIOUSLY DISCUSSED                       */}
        {/* ========================================================================= */}
        {activeTab === "roles" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {DEMO_SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isLoading = loadingAction === sec.id;

              return (
                <div
                  key={sec.id}
                  className="group relative flex flex-col justify-between rounded-3xl border border-white/15 bg-black/40 hover:bg-black/55 backdrop-blur-xl p-6 transition-all duration-300 hover:border-[#A78BFA]/50 hover:shadow-[0_10px_35px_0_rgba(139,92,246,0.25)] hover:-translate-y-1"
                >
                  {/* Card Header & Badge */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-[#A78BFA] group-hover:bg-[#8B5CF6] group-hover:text-white transition-all shadow-md">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${sec.badgeStyle}`}>
                        {sec.roleBadge}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white group-hover:text-[#A78BFA] transition-colors">
                      {sec.title}
                    </h3>
                    <p className="text-xs text-zinc-400 font-medium mb-3">
                      {sec.subtitle}
                    </p>
                    <p className="text-[11px] text-zinc-300 leading-relaxed mb-4">
                      {sec.description}
                    </p>

                    {/* Feature bullets */}
                    <ul className="space-y-1.5 mb-5 text-[11px] text-zinc-300 border-t border-white/10 pt-3">
                      {sec.keyCapabilities.map((cap, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-[#34D399] shrink-0 font-bold">✓</span>
                          <span>{cap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card Bottom / Action */}
                  <div className="space-y-2 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>{sec.email}</span>
                      <span className="text-zinc-500">•</span>
                      <span>1-Click</span>
                    </div>

                    <button
                      type="button"
                      disabled={loadingAction !== null}
                      onClick={() => handleDemoLogin(sec)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] shadow-md shadow-purple-900/30 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Authenticating...</span>
                        </>
                      ) : (
                        <>
                          <span>Enter as {sec.title.split(" ")[0]}</span>
                          <span className="text-sm leading-none">→</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: SIGN IN WITH EXISTING CREDENTIALS (GLASSMORPHISM BLOCK)           */}
        {/* ========================================================================= */}
        {activeTab === "signin" && (
          <div className="max-w-md mx-auto w-full">
            <div className="relative rounded-3xl border border-white/20 bg-black/40 backdrop-blur-2xl p-7 sm:p-9 shadow-[0_12px_45px_0_rgba(0,0,0,0.6)]">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white">Sign In to CIT Campus OS</h2>
                <p className="text-xs text-zinc-300 mt-1">
                  Enter your registered institutional credentials to access your portal.
                </p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                {/* Email field */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Institutional Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. admin@cit-demo.test"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 backdrop-blur-md focus:border-[#A78BFA] focus:bg-white/10 focus:outline-hidden transition-all"
                  />
                </div>

                {/* Password field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-zinc-300">Password</label>
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                      className="text-[11px] text-[#A78BFA] hover:text-white cursor-pointer"
                    >
                      {showSignInPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <input
                    type={showSignInPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 backdrop-blur-md focus:border-[#A78BFA] focus:bg-white/10 focus:outline-hidden transition-all"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loadingAction !== null}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] shadow-lg shadow-purple-900/40 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loadingAction === "signin" ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </form>

              {/* Demo accounts hint */}
              <div className="mt-6 pt-5 border-t border-white/10 text-center">
                <span className="text-[11px] text-zinc-400">Want to test with 1-click accounts?</span>
                <button
                  type="button"
                  onClick={() => setActiveTab("roles")}
                  className="block mx-auto mt-1 text-xs font-bold text-[#A78BFA] hover:underline cursor-pointer"
                >
                  View 4 Judge Demo Role Sections
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: SIGN UP BLOCK WITH FULL GLASSMORPHISM                             */}
        {/* ========================================================================= */}
        {activeTab === "signup" && (
          <div className="max-w-xl mx-auto w-full">
            <div className="relative rounded-3xl border border-white/25 bg-black/45 backdrop-blur-2xl p-7 sm:p-9 shadow-[0_16px_50px_0_rgba(0,0,0,0.65)] ring-1 ring-white/10">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase bg-purple-900/40 border border-purple-400/40 text-purple-200 mb-2">
                  <span>✦</span> Frosted Glass Sign Up
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Create Campus Account</h2>
                <p className="text-xs text-zinc-300 mt-1">
                  Register a new verified institutional account for CIT Campus OS.
                </p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Full name & Email Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-zinc-200 mb-1">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Priya Sharma"
                      value={signUpFullName}
                      onChange={(e) => setSignUpFullName(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 backdrop-blur-md focus:border-[#A78BFA] focus:bg-white/10 focus:outline-hidden transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-200 mb-1">
                      Email Address <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. p.sharma@cit.ac.in"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 backdrop-blur-md focus:border-[#A78BFA] focus:bg-white/10 focus:outline-hidden transition-all"
                    />
                  </div>
                </div>

                {/* Role selection & Department/Club */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-zinc-200 mb-1">
                      System Role <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={signUpRole}
                      onChange={(e) => setSignUpRole(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-zinc-900/90 px-3.5 py-2.5 text-xs text-white backdrop-blur-md focus:border-[#A78BFA] focus:outline-hidden cursor-pointer"
                    >
                      <option value="faculty">Faculty Member</option>
                      <option value="department_coordinator">Department Coordinator</option>
                      <option value="club_representative">Club Representative</option>
                      <option value="admin">Campus Administrator</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-200 mb-1">
                      {signUpRole === "club_representative" ? "Associated Club" : "Academic Department"}
                    </label>
                    {signUpRole === "club_representative" ? (
                      <input
                        type="text"
                        placeholder="e.g. Spectra / Robotics Club"
                        value={signUpClub}
                        onChange={(e) => setSignUpClub(e.target.value)}
                        className="w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 backdrop-blur-md focus:border-[#A78BFA] focus:bg-white/10 focus:outline-hidden transition-all"
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. CSE / ECE / ME / Civil"
                        value={signUpDepartment}
                        onChange={(e) => setSignUpDepartment(e.target.value)}
                        className="w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 backdrop-blur-md focus:border-[#A78BFA] focus:bg-white/10 focus:outline-hidden transition-all"
                      />
                    )}
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-zinc-200">
                        Password <span className="text-rose-400">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                        className="text-[10px] text-[#A78BFA] hover:text-white cursor-pointer"
                      >
                        {showSignUpPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <input
                      type={showSignUpPassword ? "text" : "password"}
                      required
                      placeholder="Min 6 characters"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 backdrop-blur-md focus:border-[#A78BFA] focus:bg-white/10 focus:outline-hidden transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-200 mb-1">
                      Confirm Password <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type={showSignUpPassword ? "text" : "password"}
                      required
                      placeholder="Re-type password"
                      value={signUpConfirmPassword}
                      onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 backdrop-blur-md focus:border-[#A78BFA] focus:bg-white/10 focus:outline-hidden transition-all"
                    />
                  </div>
                </div>

                {/* Glass Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loadingAction !== null}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-[#8B5CF6] via-[#7C3AED] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] shadow-[0_8px_30px_rgb(139,92,246,0.4)] active:scale-95 disabled:opacity-50 transition-all cursor-pointer border border-white/20"
                  >
                    {loadingAction === "signup" ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Creating Account & Issuing Session Token...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Registration & Launch Portal</span>
                        <span>✦</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Bottom toggle back to Sign In */}
              <div className="mt-5 pt-4 border-t border-white/10 text-center flex items-center justify-center gap-2 text-xs text-zinc-300">
                <span>Already registered?</span>
                <button
                  type="button"
                  onClick={() => setActiveTab("signin")}
                  className="font-bold text-[#A78BFA] hover:underline cursor-pointer"
                >
                  Sign In instead
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer with Benchmark Dataset Info */}
      <footer className="relative z-20 w-full px-4 sm:px-8 py-4 border-t border-white/10 backdrop-blur-md bg-black/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-400">
        <div>
          <span>Chilika Institute of Technology • Dataset: </span>
          <span className="font-mono text-[#A78BFA] font-semibold">cit-public-v1</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Google OR-Tools CP-SAT</span>
          <span>•</span>
          <span>Official validator.py Verified</span>
          <span>•</span>
          <span>PBKDF2 SHA-256</span>
        </div>
      </footer>
    </div>
  );
}

