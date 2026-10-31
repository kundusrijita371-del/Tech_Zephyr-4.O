"use client";

import React, { useState } from "react";
import { loginUser, setStoredAuth } from "@/lib/api";
import type { User } from "@/lib/types";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
  currentUser: User | null;
  onLogout: () => void;
}

interface DemoAccountCard {
  email: string;
  role: string;
  roleBadge: string;
  badgeColor: string;
  title: string;
  description: string;
  departmentOrClub: string;
  defaultPassword: string; // Used exclusively for judge 1-click demo convenience
}

const DEMO_CARDS: DemoAccountCard[] = [
  {
    email: "admin@cit-demo.test",
    role: "admin",
    roleBadge: "ADMINISTRATOR",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    title: "Campus Administrator",
    description: "Full authority over academic timetables, exam allocations, venue approvals, and disruption repair commits.",
    departmentOrClub: "Campus-Wide",
    defaultPassword: "CIT_Admin@2026!",
  },
  {
    email: "coordinator@cit-demo.test",
    role: "department_coordinator",
    roleBadge: "DEPT COORDINATOR",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    title: "CSE Department Coordinator",
    description: "Manages Computer Science course schedules, departmental venue allocations, and faculty teaching workloads.",
    departmentOrClub: "Department: CSE",
    defaultPassword: "CIT_Coord@2026!",
  },
  {
    email: "faculty@cit-demo.test",
    role: "faculty",
    roleBadge: "FACULTY",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    title: "Dr. CSE Faculty Member",
    description: "Views personal teaching schedule, midsem invigilation allocations, and requests guest lecture venue slots.",
    departmentOrClub: "Department: CSE",
    defaultPassword: "CIT_Faculty@2026!",
  },
  {
    email: "spectra@cit-demo.test",
    role: "club_representative",
    roleBadge: "CLUB REPRESENTATIVE",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    title: "Spectra Club Representative",
    description: "Requests festival venues during Spectra Week (P10–P13), tracks approved bookings under the 3-event club cap.",
    departmentOrClub: "Club: Spectra",
    defaultPassword: "CIT_Spectra@2026!",
  },
];

export function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUser,
  onLogout,
}: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await loginUser(email, password);
      setStoredAuth(data.access_token, data.user);
      onLoginSuccess(data.user, data.access_token);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handle1ClickLogin = async (account: DemoAccountCard) => {
    setError(null);
    setLoading(true);
    setEmail(account.email);
    setPassword(account.defaultPassword);

    try {
      const data = await loginUser(account.email, account.defaultPassword);
      setStoredAuth(data.access_token, data.user);
      onLoginSuccess(data.user, data.access_token);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg shadow-sm">
              CIT
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Judge Demo Access & Authentication
              </h3>
              <p className="text-xs text-slate-500">
                Log in to explore role-based permissions and tailored dashboard views
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {currentUser && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-sm">
                  {currentUser.full_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{currentUser.full_name}</span>
                    <span className="rounded-full bg-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-900 uppercase">
                      Active
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    {currentUser.email} • <span className="font-mono font-semibold">{currentUser.role}</span>
                    {currentUser.department && ` • ${currentUser.department}`}
                    {currentUser.club && ` • ${currentUser.club}`}
                  </div>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer shadow-xs"
              >
                Sign Out
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <svg className="h-4 w-4 shrink-0 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Section: 1-Click Judge Demo Accounts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1-Click Judge Demo Accounts (Instant Role Switch)
              </span>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                Pre-configured for evaluation
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DEMO_CARDS.map((acc) => {
                const isCurrent = currentUser?.email.toLowerCase() === acc.email.toLowerCase();
                return (
                  <button
                    key={acc.email}
                    onClick={() => handle1ClickLogin(acc)}
                    disabled={loading}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                      isCurrent
                        ? "border-blue-500 bg-blue-50/60 shadow-xs ring-2 ring-blue-500/20"
                        : "border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-md"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acc.badgeColor}`}>
                          {acc.roleBadge}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {acc.departmentOrClub}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-900 text-xs">
                        {acc.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 mb-1.5">
                        {acc.email}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                        {acc.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        Pass: <code className="font-mono text-slate-600">{acc.defaultPassword}</code>
                      </span>
                      <span className="text-[11px] font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                        {isCurrent ? "Active Account ✓" : "Switch Account →"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase">
              Or Manual Sign-in
            </span>
          </div>

          {/* Section: Manual Login Form */}
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@cit-demo.test"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? "Authenticating with Backend..." : "Sign In to CIT Portal"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
