"use client";

import React, { useEffect, useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  GraduationCap,
  Building2,
  Users,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
} from "lucide-react";
import { loginUser, setStoredAuth } from "@/lib/api";
import type { UserRole } from "@/lib/types";

interface RoleCard {
  id: UserRole;
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ROLE_CARDS: RoleCard[] = [
  {
    id: "admin",
    title: "Administrator",
    badge: "GLOBAL ACCESS",
    description: "System Administration & Scheduling Solvers",
    icon: ShieldCheck,
  },
  {
    id: "faculty",
    title: "Faculty Member",
    badge: "ACADEMIC",
    description: "Teaching Workspace & Availability Limits",
    icon: GraduationCap,
  },
  {
    id: "department_coordinator",
    title: "Department Coordinator",
    badge: "DEPARTMENT: CSE",
    description: "Department Operations & Lab Approvals",
    icon: Building2,
  },
  {
    id: "club_representative",
    title: "Club Representative",
    badge: "STUDENT ACTIVITIES",
    description: "Spectra Festival Events & Venue Requests",
    icon: Users,
  },
];

interface DemoPreset {
  name: string;
  role: UserRole;
  email: string;
  password: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DEMO_PRESETS: DemoPreset[] = [
  {
    name: "Admin Demo",
    role: "admin",
    email: "admin@cit-demo.test",
    password: "CIT_Admin@2026!",
    badge: "Full Access",
    icon: ShieldCheck,
  },
  {
    name: "Faculty Demo",
    role: "faculty",
    email: "faculty@cit-demo.test",
    password: "CIT_Faculty@2026!",
    badge: "Dr. A. Mishra (F01)",
    icon: GraduationCap,
  },
  {
    name: "Coordinator Demo",
    role: "department_coordinator",
    email: "coordinator@cit-demo.test",
    password: "CIT_Coord@2026!",
    badge: "CSE Dept",
    icon: Building2,
  },
  {
    name: "Club Demo",
    role: "club_representative",
    email: "spectra@cit-demo.test",
    password: "CIT_Spectra@2026!",
    badge: "Spectra Lead",
    icon: Users,
  },
];

function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Administrator";
    case "faculty":
      return "Faculty Member";
    case "department_coordinator":
      return "Department Coordinator";
    case "club_representative":
      return "Club Representative";
    default:
      return role;
  }
}

export default function LoginPage() {
  const router = useRouter();

  // Form states
  const [selectedRole, setSelectedRole] = useState<UserRole>("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  // Generate unique IDs for accessibility
  const emailInputId = useId();
  const passwordInputId = useId();
  const rememberCheckboxId = useId();

  // Load remembered institutional email on mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("cit_remembered_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  // Autofill demo accounts for hackathon judges
  const handleSelectDemo = (preset: DemoPreset) => {
    setSelectedRole(preset.role);
    setEmail(preset.email);
    setPassword(preset.password);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Perform secure authentication
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Please provide your institutional email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your account password.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await loginUser(trimmedEmail, password);

      // Save remember-me email if selected
      if (rememberMe) {
        try {
          localStorage.setItem("cit_remembered_email", trimmedEmail);
        } catch {
          // ignore storage error
        }
      } else {
        try {
          localStorage.removeItem("cit_remembered_email");
        } catch {
          // ignore storage error
        }
      }

      // CRITICAL SECURITY GUARD: Verify that requested category matches actual backend-assigned role
      if (response.user.role !== selectedRole) {
        setErrorMessage(
          `Unauthorized Role Mismatch: Your authenticated credentials belong to '${formatRoleLabel(
            response.user.role
          )}', but you selected '${formatRoleLabel(
            selectedRole
          )}'. Please select the '${formatRoleLabel(
            response.user.role
          )}' role card above to proceed.`
        );
        setIsLoading(false);
        return;
      }

      // Persist authenticated session token and sanitized profile
      setStoredAuth(response.access_token, response.user);
      setSuccessMessage(
        `Welcome back, ${response.user.full_name}! Redirecting to your ${formatRoleLabel(
          response.user.role
        )} workspace...`
      );

      // Brief delay for feedback then redirect to dashboard
      setTimeout(() => {
        router.push("/");
      }, 750);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed. Please verify your credentials.";
      setErrorMessage(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden font-sans">
      {/* 1. Cinematic Architectural Campus Background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-[1.02]"
        style={{
          backgroundImage: `url('/landing_hero.jpg')`,
        }}
        aria-hidden="true"
      />

      {/* 2. Soft Lavender & Twilight Indigo Overlay */}
      <div
        className="fixed inset-0 z-0 bg-gradient-to-br from-[#0F172A]/80 via-[#1E1B4B]/70 to-[#31104B]/75 backdrop-blur-[3px]"
        aria-hidden="true"
      />

      {/* 3. Top Institutional Navigation */}
      <header className="relative z-10 w-full px-4 sm:px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* CIT Branding */}
          <Link href="/" className="flex items-center gap-3 group transition-transform">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center font-black text-white text-sm shadow-md shadow-violet-900/40 border border-white/20">
              CIT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-black tracking-tight text-base sm:text-lg">
                  CIT CAMPUS OS
                </span>
                <span className="rounded-full bg-violet-400/20 px-2 py-0.5 text-[10px] font-bold text-violet-200 border border-violet-300/30">
                  v2.0
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-300/90 block">
                Chilika Institute of Technology
              </span>
            </div>
          </Link>

          {/* Back to Home / Dashboard Link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/20 shadow-xs transition-all hover:scale-[1.02]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to</span> Dashboard
          </Link>
        </div>
      </header>

      {/* 4. Main Authentication Workspace */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-10 shadow-[0_25px_70px_-15px_rgba(15,23,42,0.4)] border border-[#E2D9F3] transition-all animate-in fade-in zoom-in-95 duration-300">
          {/* Header Title */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/80 px-3 py-1 text-xs font-bold text-[#6D28D9] border border-violet-200 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Chilika Institute University Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
              Welcome to CIT Campus OS
            </h1>
            <p className="text-sm font-medium text-[#475569] mt-1.5">
              Your campus. Connected. Intelligent. In sync.
            </p>
          </div>

          {/* Quick Access for Hackathon Judges */}
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-violet-50/90 to-indigo-50/90 border border-violet-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#4338CA]">
                <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                <span>Quick Access — Hackathon Judges</span>
              </div>
              <span className="text-[10px] font-semibold text-[#6D28D9] bg-white/80 px-2 py-0.5 rounded-md border border-violet-200">
                1-Click Autofill
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DEMO_PRESETS.map((preset) => {
                const IconComponent = preset.icon;
                const isCurrent = email === preset.email;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectDemo(preset)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      isCurrent
                        ? "bg-[#7C3AED] text-white border-[#6D28D9] shadow-sm shadow-violet-400/30 scale-[1.02]"
                        : "bg-white hover:bg-violet-100/70 text-[#1E1B4B] border-violet-200/80 hover:border-violet-300 shadow-2xs"
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 mb-1 ${isCurrent ? "text-white" : "text-[#7C3AED]"}`} />
                    <span className="leading-none text-center">{preset.name}</span>
                    <span
                      className={`text-[9px] mt-0.5 font-normal truncate max-w-full ${
                        isCurrent ? "text-violet-100" : "text-[#64748B]"
                      }`}
                    >
                      {preset.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback Banners */}
          {errorMessage && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50/95 p-3.5 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/95 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {/* Role Selection Category Cards (2x2 Grid) */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-[#1E1B4B] uppercase tracking-wider mb-2">
              1. Select Your Institutional Role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ROLE_CARDS.map((card) => {
                const IconComponent = card.icon;
                const isSelected = selectedRole === card.id;

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setSelectedRole(card.id);
                      setErrorMessage(null);
                    }}
                    className={`relative p-3.5 rounded-2xl text-left transition-all cursor-pointer border ${
                      isSelected
                        ? "border-2 border-[#7C3AED] bg-[#F5F3FF] shadow-sm shadow-violet-200/60 scale-[1.01]"
                        : "border border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-2xs">
                        <CheckCircle2 className="h-3 w-3" />
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] text-white shadow-xs"
                            : "bg-slate-100 text-[#475569]"
                        }`}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="pr-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-bold leading-tight ${
                              isSelected ? "text-[#1E1B4B]" : "text-[#0F172A]"
                            }`}
                          >
                            {card.title}
                          </span>
                        </div>
                        <p
                          className={`text-[11px] leading-tight mt-0.5 ${
                            isSelected ? "text-[#6D28D9] font-medium" : "text-[#64748B]"
                          }`}
                        >
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor={emailInputId} className="block text-xs font-bold text-[#1E1B4B] uppercase tracking-wider mb-1.5">
                2. Institutional Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id={emailInputId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. admin@cit-demo.test or faculty@cit-demo.test"
                  disabled={isLoading}
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/60 pl-10 pr-4 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#7C3AED] focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all font-medium disabled:opacity-60"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor={passwordInputId} className="block text-xs font-bold text-[#1E1B4B] uppercase tracking-wider mb-1.5">
                3. Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id={passwordInputId}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/60 pl-10 pr-10 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#7C3AED] focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all font-medium disabled:opacity-60"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label htmlFor={rememberCheckboxId} className="flex items-center gap-2 text-[#475569] font-medium cursor-pointer">
                <input
                  id={rememberCheckboxId}
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded-md border-slate-300 text-[#7C3AED] focus:ring-[#7C3AED] cursor-pointer"
                />
                <span>Remember my institutional ID</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotNotice(!showForgotNotice)}
                className="text-xs font-semibold text-[#7C3AED] hover:text-[#6D28D9] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* Help / Password Reset Notice */}
            {showForgotNotice && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-3 text-xs text-[#4338CA] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#7C3AED] shrink-0 mt-0.5" />
                <p>
                  For credential recovery or institutional password resets, please contact the CIT IT Support
                  Helpdesk at <strong className="font-semibold">it-support@cit.ac.in</strong> or use the 1-click Judge
                  Demo accounts above.
                </p>
              </div>
            )}

            {/* Sign In Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 rounded-xl bg-gradient-to-r from-[#7C3AED] via-[#6D28D9] to-[#4F46E5] hover:opacity-95 text-white font-bold py-3 px-4 shadow-lg shadow-violet-500/25 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span>Authenticating Credentials...</span>
                </>
              ) : (
                <span>Sign In to {formatRoleLabel(selectedRole)} Portal</span>
              )}
            </button>
          </form>

          {/* Institutional Trust Security Notice */}
          <div className="mt-6 pt-5 border-t border-slate-200/80 text-center">
            <p className="text-[11px] text-[#64748B]">
              Protected institutional gateway • Authenticated via PBKDF2 cryptography & Bearer Tokens
            </p>
          </div>
        </div>
      </main>

      {/* 5. Institutional Footer */}
      <footer className="relative z-10 w-full px-4 py-4 text-center">
        <p className="text-xs text-slate-300/80 font-medium">
          © 2026 Chilika Institute of Technology. All rights reserved. • CIT CAMPUS OS
        </p>
      </footer>
    </div>
  );
}
