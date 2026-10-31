"use client";

import React, { useState } from "react";
import Image from "next/image";
import { loginUser, setStoredAuth } from "@/lib/api";
import type { User } from "@/lib/types";

interface LandingPageProps {
  onLoginSuccess: (user: User, token: string) => void;
}

interface DemoAccount {
  id: string;
  email: string;
  title: string;
  role: string;
  description: string;
  password: string;
  icon: (props: { className?: string }) => React.JSX.Element;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "admin",
    email: "admin@cit-demo.test",
    title: "Administrator",
    role: "admin",
    description: "Full campus access",
    password: "CIT_Admin@2026!",
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    id: "faculty",
    email: "faculty@cit-demo.test",
    title: "Faculty",
    role: "faculty",
    description: "Academic workspace",
    password: "CIT_Faculty@2026!",
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
      </svg>
    ),
  },
  {
    id: "club",
    email: "spectra@cit-demo.test",
    title: "Club Representative",
    role: "club_representative",
    description: "Event & venue bookings",
    password: "CIT_Spectra@2026!",
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "coordinator",
    email: "coordinator@cit-demo.test",
    title: "Department Coordinator",
    role: "department_coordinator",
    description: "Department operations",
    password: "CIT_Coord@2026!",
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
];

export function LandingPage({ onLoginSuccess }: LandingPageProps) {
  // Theme state: "light" matches the exact uploaded mockup, "dark" matches Obsidian Lavender
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activeAuthTab, setActiveAuthTab] = useState<"quick" | "form">("quick");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  // 1-Click Login for Judge Demo Accounts
  const handleDemoLogin = async (acc: DemoAccount) => {
    setLoadingAccount(acc.id);
    setErrorMessage(null);
    try {
      const data = await loginUser(acc.email, acc.password);
      setStoredAuth(data.access_token, data.user);
      onLoginSuccess(data.user, data.access_token);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoadingAccount(null);
    }
  };

  // Manual Credentials Login
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }
    setLoadingAccount("manual");
    setErrorMessage(null);
    try {
      const data = await loginUser(email, password);
      setStoredAuth(data.access_token, data.user);
      onLoginSuccess(data.user, data.access_token);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoadingAccount(null);
    }
  };

  const isDark = theme === "dark";

  return (
    <div
      className={`min-h-screen w-full transition-colors duration-300 ${
        isDark ? "bg-[#101014] text-[#F4F2FA]" : "bg-[#F4F4F8] text-[#1E1E24]"
      }`}
    >
      {/* Top Floating Bar with Dual Theme Switch */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center font-black text-white text-xs tracking-wider shadow-md shadow-purple-900/20">
            CIT
          </div>
          <div>
            <div className={`text-sm font-bold tracking-tight leading-none ${isDark ? "text-white" : "text-gray-900"}`}>
              CIT CAMPUS OS
            </div>
            <div className={`text-[10px] font-medium leading-tight ${isDark ? "text-[#71717A]" : "text-gray-500"}`}>
              Chilika Institute of Technology
            </div>
          </div>
        </div>

        {/* Quick Dark / Light Switch for Hackathon Judges */}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1 rounded-full border shadow-sm backdrop-blur-md transition-all duration-200">
          <div
            className={`flex items-center gap-1 rounded-full p-0.5 border ${
              isDark
                ? "bg-[#19191F]/90 border-[#30303A]"
                : "bg-white/95 border-gray-200"
            }`}
          >
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isDark
                  ? "bg-[#292933] text-[#A78BFA] shadow-xs"
                  : "text-gray-500 hover:text-gray-800"
              }`}
              title="Obsidian Lavender Theme (Dark)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <span>Obsidian Dark</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                !isDark
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-[#71717A] hover:text-[#F4F2FA]"
              }`}
              title="Light Mockup Theme (Original Design)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Mockup Light</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main 2-Column Split Layout */}
      <div className="min-h-screen w-full flex flex-col lg:flex-row items-stretch pt-16 lg:pt-0">
        {/* ================================================================= */}
        {/* LEFT COLUMN: HERO SHOWCASE (CHILIKA INSTITUTE OF TECHNOLOGY)       */}
        {/* ================================================================= */}
        <div className="relative w-full lg:w-[54%] flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden">
          {/* Background Campus Image Layer */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/campus_hero_left.jpg"
              alt="Chilika Institute of Technology Campus"
              fill
              priority
              className="object-cover object-center scale-105"
            />
            {/* Ambient Overlay dependent on Theme */}
            <div
              className={`absolute inset-0 transition-opacity duration-300 ${
                isDark
                  ? "bg-gradient-to-t from-[#101014] via-[#101014]/75 to-[#101014]/60 mix-blend-multiply"
                  : "bg-gradient-to-t from-white/95 via-white/70 to-white/40"
              }`}
            />
            {/* Glowing Lavender Aurora Ribbon overlay */}
            <div
              className={`absolute -bottom-20 -left-20 w-[600px] h-[350px] rounded-full blur-[100px] pointer-events-none transition-all duration-500 ${
                isDark ? "bg-purple-900/35" : "bg-purple-400/25"
              }`}
            />
            <div
              className={`absolute top-1/4 right-0 w-[400px] h-[300px] rounded-full blur-[120px] pointer-events-none transition-all duration-500 ${
                isDark ? "bg-violet-950/40" : "bg-violet-300/20"
              }`}
            />
          </div>

          {/* Foreground Hero Content */}
          <div className="relative z-10 flex flex-col justify-between h-full space-y-12 my-auto">
            {/* Brand Pill (Top Left) */}
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center font-black text-white text-base tracking-wider shadow-lg shadow-purple-600/30">
                CIT
              </div>
              <div>
                <h2 className={`text-lg font-black tracking-tight leading-none ${isDark ? "text-white" : "text-gray-900"}`}>
                  CIT CAMPUS OS
                </h2>
                <p className={`text-xs font-medium tracking-wide mt-0.5 ${isDark ? "text-[#A1A1AA]" : "text-gray-600"}`}>
                  Chilika Institute of Technology
                </p>
              </div>
            </div>

            {/* Central Typography Showcase */}
            <div className="max-w-xl space-y-5">
              <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] ${
                isDark ? "text-[#F4F2FA]" : "text-[#0F172A]"
              }`}>
                The Intelligence <br />
                <span className="bg-gradient-to-r from-[#A78BFA] via-[#8B5CF6] to-[#7C3AED] bg-clip-text text-transparent">
                  Behind Every Campus.
                </span>
              </h1>
              <p className={`text-base sm:text-lg font-normal leading-relaxed max-w-lg ${
                isDark ? "text-[#A1A1AA]" : "text-gray-700 font-medium"
              }`}>
                Smart scheduling, venue management and seamless campus operations — for a more connected institution.
              </p>
            </div>

            {/* 4 Core Platform Feature Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl pt-4">
              {/* 1. Timetable Management */}
              <div
                className={`flex flex-col items-center sm:items-start text-center sm:text-left gap-2 p-3.5 rounded-2xl border transition-all ${
                  isDark
                    ? "bg-[#19191F]/70 border-[#30303A] backdrop-blur-md hover:bg-[#202027]/80"
                    : "bg-white/85 border-gray-200/90 shadow-xs hover:bg-white"
                }`}
              >
                <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-[#A78BFA] flex items-center justify-center">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className={`text-xs font-bold leading-tight ${isDark ? "text-[#F4F2FA]" : "text-gray-900"}`}>
                  Timetable Management
                </div>
              </div>

              {/* 2. Venue Bookings */}
              <div
                className={`flex flex-col items-center sm:items-start text-center sm:text-left gap-2 p-3.5 rounded-2xl border transition-all ${
                  isDark
                    ? "bg-[#19191F]/70 border-[#30303A] backdrop-blur-md hover:bg-[#202027]/80"
                    : "bg-white/85 border-gray-200/90 shadow-xs hover:bg-white"
                }`}
              >
                <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className={`text-xs font-bold leading-tight ${isDark ? "text-[#F4F2FA]" : "text-gray-900"}`}>
                  Venue Bookings
                </div>
              </div>

              {/* 3. Disruption Handling */}
              <div
                className={`flex flex-col items-center sm:items-start text-center sm:text-left gap-2 p-3.5 rounded-2xl border transition-all ${
                  isDark
                    ? "bg-[#19191F]/70 border-[#30303A] backdrop-blur-md hover:bg-[#202027]/80"
                    : "bg-white/85 border-gray-200/90 shadow-xs hover:bg-white"
                }`}
              >
                <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className={`text-xs font-bold leading-tight ${isDark ? "text-[#F4F2FA]" : "text-gray-900"}`}>
                  Disruption Handling
                </div>
              </div>

              {/* 4. AI Assistant */}
              <div
                className={`flex flex-col items-center sm:items-start text-center sm:text-left gap-2 p-3.5 rounded-2xl border transition-all ${
                  isDark
                    ? "bg-[#19191F]/70 border-[#30303A] backdrop-blur-md hover:bg-[#202027]/80"
                    : "bg-white/85 border-gray-200/90 shadow-xs hover:bg-white"
                }`}
              >
                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div className={`text-xs font-bold leading-tight ${isDark ? "text-[#F4F2FA]" : "text-gray-900"}`}>
                  AI Assistant
                </div>
              </div>
            </div>

            {/* Bottom Campus Branding Monogram */}
            <div className={`pt-6 border-t ${isDark ? "border-[#30303A]/50 text-[#71717A]" : "border-gray-200 text-gray-500"} text-xs flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-purple-400">CIT Chilika</span>
                <span>•</span>
                <span>Autonomous Academic Institution</span>
              </div>
              <span className="font-mono text-[11px] opacity-75">OR-Tools CP-SAT v9.2</span>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT COLUMN: INTERACTIVE AUTHENTICATION & JUDGE 1-CLICK ACCESS   */}
        {/* ================================================================= */}
        <div className="w-full lg:w-[46%] flex items-center justify-center p-6 sm:p-10 lg:p-12 relative z-10">
          <div
            className={`w-full max-w-lg rounded-3xl border transition-all duration-300 p-8 sm:p-10 shadow-2xl ${
              isDark
                ? "bg-[#19191F]/90 border-[#30303A] backdrop-blur-xl shadow-black/60"
                : "bg-white border-gray-100 shadow-xl shadow-slate-200/50"
            }`}
          >
            {/* Header: Welcome Text */}
            <div className="space-y-1 mb-7">
              <h2
                className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                  isDark ? "text-[#F4F2FA]" : "text-gray-900"
                }`}
              >
                Welcome to CIT Campus OS
              </h2>
              <p className={`text-sm ${isDark ? "text-[#A1A1AA]" : "text-gray-500"}`}>
                Sign in to access your campus workspace
              </p>
            </div>

            {/* Tab Switcher Pills */}
            <div
              className={`grid grid-cols-2 p-1 rounded-2xl mb-6 border ${
                isDark ? "bg-[#141419] border-[#30303A]" : "bg-gray-100 border-gray-200"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveAuthTab("quick")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeAuthTab === "quick"
                    ? isDark
                      ? "bg-[#202027] text-[#A78BFA] border border-[#A78BFA]/30 shadow-xs"
                      : "bg-white text-purple-700 border border-purple-200 shadow-xs"
                    : isDark
                    ? "text-[#71717A] hover:text-[#F4F2FA]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Quick Login (Judge Demo)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAuthTab("form")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeAuthTab === "form"
                    ? isDark
                      ? "bg-[#202027] text-[#A78BFA] border border-[#A78BFA]/30 shadow-xs"
                      : "bg-white text-purple-700 border border-purple-200 shadow-xs"
                    : isDark
                    ? "text-[#71717A] hover:text-[#F4F2FA]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Email & Password</span>
              </button>
            </div>

            {/* Error Notification Alert */}
            {errorMessage && (
              <div
                className={`mb-5 p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                  isDark
                    ? "bg-rose-950/40 border-rose-800/60 text-rose-300"
                    : "bg-rose-50 border-rose-200 text-rose-700"
                }`}
              >
                <svg className="h-4 w-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* DEMO 1-CLICK ACCOUNTS SECTION (Always visible or in Quick Tab) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-xs font-bold tracking-wide uppercase ${
                    isDark ? "text-[#A1A1AA]" : "text-gray-600"
                  }`}
                >
                  Login as (Demo Accounts for Judges)
                </span>
                <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                  1-Click Instant
                </span>
              </div>

              {/* 2x2 Grid matching the screenshot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isLoading = loadingAccount === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      disabled={loadingAccount !== null}
                      onClick={() => handleDemoLogin(acc)}
                      className={`group relative flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all duration-150 ${
                        isDark
                          ? "bg-[#202027] border-[#30303A] hover:border-[#A78BFA]/50 hover:bg-[#292933]"
                          : "bg-gray-50/80 border-gray-200/90 hover:border-purple-300 hover:bg-purple-50/40 shadow-xs"
                      } ${isLoading ? "opacity-75" : ""}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                            isDark
                              ? "bg-[#141419] text-[#A78BFA] group-hover:bg-[#8B5CF6]/20"
                              : "bg-purple-100 text-purple-700 group-hover:bg-purple-200"
                          }`}
                        >
                          {isLoading ? (
                            <svg className="h-4 w-4 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          ) : (
                            <acc.icon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-bold leading-tight truncate ${
                              isDark ? "text-[#F4F2FA]" : "text-gray-900"
                            }`}
                          >
                            {acc.title}
                          </div>
                          <div
                            className={`text-[10px] leading-tight truncate mt-0.5 ${
                              isDark ? "text-[#71717A]" : "text-gray-500"
                            }`}
                          >
                            {acc.description}
                          </div>
                        </div>
                      </div>

                      {/* Right Arrow */}
                      <svg
                        className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${
                          isDark ? "text-[#71717A] group-hover:text-[#A78BFA]" : "text-gray-400 group-hover:text-purple-600"
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider "OR" */}
            <div className="relative flex items-center justify-center my-6">
              <div
                className={`w-full border-t ${
                  isDark ? "border-[#30303A]" : "border-gray-200"
                }`}
              />
              <span
                className={`absolute px-3 text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? "bg-[#19191F] text-[#71717A]" : "bg-white text-gray-400"
                }`}
              >
                OR
              </span>
            </div>

            {/* Credentials Login Form */}
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wide mb-1 text-left">
                <span className={isDark ? "text-[#A1A1AA]" : "text-gray-600"}>
                  Login with your account
                </span>
              </div>

              {/* Email Input */}
              <div className="space-y-1 text-left">
                <div
                  className={`relative flex items-center rounded-2xl border transition-all ${
                    isDark
                      ? "bg-[#202027] border-[#30303A] focus-within:border-[#A78BFA] text-[#F4F2FA]"
                      : "bg-white border-gray-200 focus-within:border-purple-600 text-gray-900 shadow-xs"
                  }`}
                >
                  <div className="pl-3.5 pointer-events-none text-gray-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your institutional email"
                    className={`w-full bg-transparent px-3 py-3 text-xs focus:outline-hidden ${
                      isDark ? "placeholder-[#71717A]" : "placeholder-gray-400"
                    }`}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1 text-left">
                <div
                  className={`relative flex items-center rounded-2xl border transition-all ${
                    isDark
                      ? "bg-[#202027] border-[#30303A] focus-within:border-[#A78BFA] text-[#F4F2FA]"
                      : "bg-white border-gray-200 focus-within:border-purple-600 text-gray-900 shadow-xs"
                  }`}
                >
                  <div className="pl-3.5 pointer-events-none text-gray-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`w-full bg-transparent px-3 py-3 text-xs focus:outline-hidden ${
                      isDark ? "placeholder-[#71717A]" : "placeholder-gray-400"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="pr-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Forgot password link */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(true)}
                  className={`text-xs font-medium hover:underline transition-colors ${
                    isDark ? "text-[#A78BFA]" : "text-purple-600"
                  }`}
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loadingAccount !== null}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] transition-all duration-200 shadow-md shadow-purple-900/30 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {loadingAccount === "manual" ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl transition-all ${
              isDark ? "bg-[#19191F] border-[#30303A] text-[#F4F2FA]" : "bg-white border-gray-200 text-gray-900"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#30303A]/40">
              <h3 className="font-bold text-sm">Judge Demo Account Credentials</h3>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="py-4 space-y-3 text-xs">
              <p className={isDark ? "text-[#A1A1AA]" : "text-gray-600"}>
                For hackathon evaluation, CIT Campus OS is pre-seeded with 4 active demo accounts. Click any card in the Quick Login grid or use these credentials:
              </p>
              <div className={`p-3 rounded-xl font-mono text-[11px] space-y-1.5 ${isDark ? "bg-[#202027]" : "bg-gray-100"}`}>
                <div><strong>Admin:</strong> admin@cit-demo.test / CIT_Admin@2026!</div>
                <div><strong>Coordinator:</strong> coordinator@cit-demo.test / CIT_Coord@2026!</div>
                <div><strong>Faculty:</strong> faculty@cit-demo.test / CIT_Faculty@2026!</div>
                <div><strong>Club Rep:</strong> spectra@cit-demo.test / CIT_Spectra@2026!</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForgotModalOpen(false)}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-[#8B5CF6] text-white hover:bg-[#7C3AED] transition-colors"
            >
              Got it, Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
