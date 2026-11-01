"use client";

import React, { useState } from "react";
import Image from "next/image";
import { loginUser, setStoredAuth, signupUser } from "@/lib/api";
import type { User } from "@/lib/types";

interface CampusLoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  onContinueAsGuest?: () => void;
}

interface DemoAccount {
  id: string;
  email: string;
  title: string;
  role: string;
  roleBadge: string;
  badgeStyle: string;
  description: string;
  password: string;
  departmentOrClub: string;
}

const JUDGE_DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "admin",
    email: "admin@cit-demo.test",
    title: "Campus Administrator",
    role: "admin",
    roleBadge: "ADMIN",
    badgeStyle: "bg-purple-900/70 text-purple-200 border-purple-600/50",
    description: "Full campus access: Timetable, Exams, Bookings, Rescheduling & Settings",
    password: "CIT_Admin@2026!",
    departmentOrClub: "Campus-Wide",
  },
  {
    id: "coordinator",
    email: "coordinator@cit-demo.test",
    title: "CSE Coordinator",
    role: "department_coordinator",
    roleBadge: "COORDINATOR",
    badgeStyle: "bg-blue-900/70 text-blue-200 border-blue-600/50",
    description: "CSE Department Timetable, Faculty Teaching Hours & Lab Approvals",
    password: "CIT_Coord@2026!",
    departmentOrClub: "Dept: CSE",
  },
  {
    id: "faculty",
    email: "faculty@cit-demo.test",
    title: "Dr. Ananya Mishra",
    role: "faculty",
    roleBadge: "FACULTY",
    badgeStyle: "bg-emerald-900/70 text-emerald-200 border-emerald-600/50",
    description: "Personal 7-session timetable complying with 4h max workload (Rule H12)",
    password: "CIT_Faculty@2026!",
    departmentOrClub: "Dept: CSE",
  },
  {
    id: "club",
    email: "spectra@cit-demo.test",
    title: "Spectra Club Lead",
    role: "club_representative",
    roleBadge: "CLUB LEAD",
    badgeStyle: "bg-amber-900/70 text-amber-200 border-amber-600/50",
    description: "Spectra Festival venue booking requests under 3-event cap (Rule B3)",
    password: "CIT_Spectra@2026!",
    departmentOrClub: "Club: Spectra",
  },
];

export function CampusLoginPage({ onLoginSuccess, onContinueAsGuest }: CampusLoginPageProps) {
  // Mode: "signup" (default matching user picture) | "signin" | "judge"
  const [mode, setMode] = useState<"signup" | "signin" | "judge">("signup");

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("faculty");
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingAccountId, setLoadingAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sign In handler
  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await loginUser(email.trim(), password);
      setStoredAuth(res.access_token, res.user);
      onLoginSuccess(res.user, res.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in. Verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  // Workable Sign Up handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please provide both email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await signupUser(
        email.trim(),
        password,
        fullName.trim() || undefined,
        role,
        "CSE"
      );
      setStoredAuth(res.access_token, res.user);
      setSuccessMessage(`Account created! Welcome, ${res.user.full_name}.`);
      setTimeout(() => {
        onLoginSuccess(res.user, res.access_token);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Judge Demo Login
  const handleJudgeLogin = async (acc: DemoAccount) => {
    setLoadingAccountId(acc.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await loginUser(acc.email, acc.password);
      setStoredAuth(res.access_token, res.user);
      onLoginSuccess(res.user, res.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to authenticate as ${acc.title}.`);
    } finally {
      setLoadingAccountId(null);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden font-sans select-none">
      {/* Background Campus Image from User Specification */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/cit_campus_bg.jpg"
          alt="Chilika Institute of Technology Campus"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Subtle dark gradient overlay to ensure contrast and readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/50" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#8B5CF6] via-[#6D28D9] to-[#4C1D95] border border-white/30 shadow-lg flex items-center justify-center font-black text-white text-sm">
            CIT
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-white tracking-wide drop-shadow-md">
              Chilika Institute of Technology
            </h1>
            <p className="text-[11px] text-white/80 font-mono tracking-wider drop-shadow-sm">
              Campus Scheduling & Venue Management OS
            </p>
          </div>
        </div>

        {/* Quick Skip to Guest / Admin Dashboard */}
        {onContinueAsGuest && (
          <button
            onClick={onContinueAsGuest}
            className="rounded-xl border border-white/30 bg-black/30 hover:bg-black/50 backdrop-blur-md px-4 py-2 text-xs font-semibold text-white/90 hover:text-white transition-all cursor-pointer shadow-md"
          >
            Direct Dashboard Preview &rarr;
          </button>
        )}
      </header>

      {/* Main Content Area: Left Branding / Right Frosted Glass Auth Card */}
      <main className="relative z-10 flex min-h-[calc(100vh-180px)] flex-col lg:flex-row items-center justify-between px-6 sm:px-12 lg:px-16 pb-24">
        {/* Left Side: Campus Identity */}
        <div className="w-full lg:max-w-xl text-left py-6 lg:py-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 backdrop-blur-md px-4 py-1.5 text-xs font-semibold text-white/90 mb-4 shadow-lg">
            <span className="h-2 w-2 rounded-full bg-[#34D399] animate-pulse" />
            <span>Tech Zephyr 4.0 Hackathon • Production Build</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg leading-tight">
            Next-Gen Campus <br />
            <span className="bg-gradient-to-r from-amber-200 via-orange-300 to-rose-300 bg-clip-text text-transparent">
              Scheduling & Venue OS
            </span>
          </h2>

          <p className="mt-4 text-sm sm:text-base text-white/90 drop-shadow-md max-w-lg leading-relaxed">
            Multi-threaded Google OR-Tools CP-SAT constraint engine powering university timetables, midsem exam rooming, and Spectra Festival venue allocations with zero hard clashes.
          </p>

          {/* Quick Features List */}
          <div className="mt-6 grid grid-cols-2 gap-3 max-w-md text-xs text-white/90 font-medium">
            <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/15 backdrop-blur-md p-2.5">
              <span className="text-[#34D399] font-bold">&check;</span>
              <span>189 Teaching Sessions</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/15 backdrop-blur-md p-2.5">
              <span className="text-[#34D399] font-bold">&check;</span>
              <span>41 Midsem Exam Halls</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/15 backdrop-blur-md p-2.5">
              <span className="text-[#34D399] font-bold">&check;</span>
              <span>Spectra Priority B1–B6</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/15 backdrop-blur-md p-2.5">
              <span className="text-[#34D399] font-bold">&check;</span>
              <span>Atomic Rescheduling</span>
            </div>
          </div>
        </div>

        {/* Right Side: Frosted Glass Auth Card (Replicating User's Picture Exactly) */}
        <div className="w-full max-w-md my-4 lg:my-0 lg:ml-auto">
          <div className="relative rounded-3xl border border-white/25 bg-white/10 dark:bg-black/40 backdrop-blur-2xl p-7 sm:p-9 shadow-2xl transition-all duration-300">
            {/* Top Switcher Tabs: Sign Up | Sign In | Judge Demo */}
            <div className="flex items-center justify-between border-b border-white/20 pb-4 mb-6">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className={`text-2xl font-bold tracking-tight transition-all cursor-pointer ${
                    mode === "signup" ? "text-white" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  Sign Up
                </button>
                <span className="text-white/30 text-xl font-light">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className={`text-2xl font-bold tracking-tight transition-all cursor-pointer ${
                    mode === "signin" ? "text-white" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  Sign In
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode("judge");
                  setError(null);
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                  mode === "judge"
                    ? "bg-[#8B5CF6] text-white border-white/40 shadow-sm"
                    : "bg-white/10 text-white/80 border-white/20 hover:bg-white/20"
                }`}
              >
                Judges 4 Roles
              </button>
            </div>

            {/* Subtitle / Mode Toggle Link */}
            {mode === "signup" && (
              <p className="text-xs text-white/80 mb-6">
                Already a member?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-bold text-[#3B82F6] hover:text-[#60A5FA] underline transition-colors cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            )}

            {mode === "signin" && (
              <p className="text-xs text-white/80 mb-6">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-bold text-[#3B82F6] hover:text-[#60A5FA] underline transition-colors cursor-pointer"
                >
                  Sign Up
                </button>
              </p>
            )}

            {mode === "judge" && (
              <p className="text-xs text-white/80 mb-4">
                Select any of the 4 designated judge evaluation demo accounts for 1-click instant login:
              </p>
            )}

            {/* Alerts */}
            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/50 bg-rose-950/60 p-3 text-xs text-rose-200">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 rounded-xl border border-emerald-500/50 bg-emerald-950/60 p-3 text-xs text-emerald-200">
                {successMessage}
              </div>
            )}

            {/* Form in Sign Up / Sign In Mode */}
            {mode !== "judge" ? (
              <form onSubmit={mode === "signup" ? handleSignUp : handleSignIn} className="space-y-5">
                {/* Full Name (Sign Up only) */}
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-semibold text-white/90 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Priya Sen"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-transparent border-b border-white/60 focus:border-[#3B82F6] pb-2 text-sm text-white placeholder-white/40 focus:outline-hidden transition-colors"
                    />
                  </div>
                )}

                {/* Email Input with Underline Style (matching user picture) */}
                <div>
                  <label className="block text-xs font-semibold text-white/90 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="user@campus.cit.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent border-b border-white/60 focus:border-[#3B82F6] pb-2 text-sm text-white placeholder-white/40 focus:outline-hidden transition-colors font-mono"
                  />
                </div>

                {/* Password Input with Underline Style (matching user picture) */}
                <div>
                  <label className="block text-xs font-semibold text-white/90 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent border-b border-white/60 focus:border-[#3B82F6] pb-2 text-sm text-white placeholder-white/40 focus:outline-hidden transition-colors font-mono"
                  />
                </div>

                {/* Role Selector (Sign Up only) */}
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-semibold text-white/90 mb-1">
                      Campus Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full rounded-lg bg-black/40 border border-white/30 px-3 py-2 text-xs text-white focus:border-[#3B82F6] focus:outline-hidden cursor-pointer"
                    >
                      <option value="faculty" className="bg-[#19191F] text-white">
                        Faculty Member (Teaching & Workload)
                      </option>
                      <option value="club_representative" className="bg-[#19191F] text-white">
                        Club Representative (Spectra Festival)
                      </option>
                      <option value="department_coordinator" className="bg-[#19191F] text-white">
                        Department Coordinator (CSE)
                      </option>
                    </select>
                  </div>
                )}

                {/* Remember Me & Forget Password Row (matching user picture) */}
                <div className="flex items-center justify-between pt-1 text-xs text-white/90">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded-md border-white/50 bg-white/20 text-[#1D68F2] focus:ring-0 focus:outline-hidden cursor-pointer accent-[#1D68F2]"
                    />
                    <span>Remember Me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      alert("Demo credentials are pre-configured: Admin, Coordinator, Faculty, and Club representative accounts are ready to use via the 4 Judge buttons below.")
                    }
                    className="text-white/80 hover:text-white hover:underline transition-colors cursor-pointer"
                  >
                    Forget Password?
                  </button>
                </div>

                {/* Vibrant Blue Submit Button (matching user picture) */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#1D68F2] hover:bg-[#1557D0] text-white font-bold py-3.5 shadow-lg shadow-blue-600/30 active:scale-98 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm mt-4"
                >
                  {loading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>{mode === "signup" ? "Creating Account..." : "Signing In..."}</span>
                    </>
                  ) : (
                    <span>{mode === "signup" ? "Sign Up" : "Sign In"}</span>
                  )}
                </button>
              </form>
            ) : (
              /* Judge Demo 4 Roles Section Inside Card */
              <div className="space-y-3">
                {JUDGE_DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleJudgeLogin(acc)}
                    disabled={loadingAccountId !== null}
                    className="w-full rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 text-left transition-all cursor-pointer hover:border-white/40 flex items-center justify-between group shadow-sm disabled:opacity-50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                          {acc.title}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${acc.badgeStyle}`}>
                          {acc.roleBadge}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/70 line-clamp-1 mt-0.5">
                        {acc.description}
                      </p>
                      <span className="text-[10px] text-white/50 font-mono">
                        {acc.email}
                      </span>
                    </div>

                    <div className="shrink-0 ml-2">
                      {loadingAccountId === acc.id ? (
                        <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : (
                        <span className="rounded-lg bg-[#1D68F2] px-2 py-1 text-[10px] font-bold text-white shadow-xs group-hover:bg-blue-500">
                          1-Click &rarr;
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Persistent 4 Judge Sections Bottom Bar (Explicitly Required: 'and for judges the 4 section') */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/20 bg-black/60 backdrop-blur-xl px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Judge Evaluation Accounts:
            </span>
            <span className="text-xs text-white/70 hidden lg:inline">
              (Click any of the 4 roles below for instant 1-click dashboard login)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
            {JUDGE_DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => handleJudgeLogin(acc)}
                disabled={loadingAccountId !== null}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/25 px-3 py-2 text-left transition-all cursor-pointer shadow-sm hover:border-[#1D68F2] active:scale-95 disabled:opacity-50"
                title={`Log in as ${acc.title} (${acc.email})`}
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-white truncate">
                    {acc.title}
                  </div>
                  <div className="text-[9px] text-white/60 font-mono truncate">
                    {acc.departmentOrClub}
                  </div>
                </div>

                {loadingAccountId === acc.id ? (
                  <svg className="h-3.5 w-3.5 animate-spin text-white shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${acc.badgeStyle}`}>
                    {acc.roleBadge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
