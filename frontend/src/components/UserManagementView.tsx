"use client";

import React from "react";
import type { User } from "@/lib/types";

interface UserManagementViewProps {
  currentUser: User | null;
  onOpenLogin: () => void;
}

const DEMO_ACCOUNTS_INFO = [
  {
    email: "admin@cit-demo.test",
    name: "CIT Campus Administrator",
    role: "admin",
    badge: "Admin",
    badgeColor: "bg-purple-950/60 text-purple-300 border-purple-800/60",
    scope: "Full Campus Scheduling, Solver Models, Priority Queues, Demo Reset",
    department: null,
    club: null,
    demoPassword: "CIT_Admin@2026!",
  },
  {
    email: "coordinator@cit-demo.test",
    name: "Dr. Rajesh Sharma (Coordinator)",
    role: "department_coordinator",
    badge: "Coordinator",
    badgeColor: "bg-blue-950/60 text-blue-300 border-blue-800/60",
    scope: "CSE Department Timetable, Lab Allocation Approvals, Faculty Oversight",
    department: "Computer Science & Engineering",
    club: null,
    demoPassword: "CIT_Coord@2026!",
  },
  {
    email: "faculty@cit-demo.test",
    name: "Prof. Priya Verma (Faculty)",
    role: "faculty",
    badge: "Faculty",
    badgeColor: "bg-emerald-950/60 text-emerald-300 border-emerald-800/60",
    scope: "Personal Teaching Timetable, Max 4h/day Availability, Guest Lectures",
    department: "Computer Science & Engineering",
    club: null,
    demoPassword: "CIT_Faculty@2026!",
  },
  {
    email: "spectra@cit-demo.test",
    name: "Aman Gupta (Spectra Festival Lead)",
    role: "club_representative",
    badge: "Club Lead",
    badgeColor: "bg-amber-950/60 text-amber-300 border-amber-800/60",
    scope: "Spectra Festival Event Bookings, 3-Booking Allocation Cap, Decisions",
    department: null,
    club: "Spectra",
    demoPassword: "CIT_Spectra@2026!",
  },
];

export function UserManagementView({ currentUser, onOpenLogin }: UserManagementViewProps) {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#A78BFA]" />
            <h2 className="text-xl font-bold tracking-tight text-[#F4F2FA]">
              Role-Based Access Control &amp; Demo Account Registry
            </h2>
          </div>
          <p className="text-xs text-[#A1A1AA]">
            Pre-configured judge evaluation accounts with strict backend-enforced authorization scopes.
          </p>
        </div>

        <button
          onClick={onOpenLogin}
          className="rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#8B5CF6]/30 transition-all cursor-pointer flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>Switch Active Demo Account</span>
        </button>
      </div>

      {/* Security Architecture Callout */}
      <div className="rounded-2xl border border-purple-900/40 bg-purple-950/20 p-5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#34D399]" />
          <h4 className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider">
            Deterministic Security Guarantees
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#A1A1AA]">
          <div className="rounded-xl border border-[#30303A] bg-[#141419] p-3 space-y-1">
            <span className="font-semibold text-[#F4F2FA]">PBKDF2 Password Hashing</span>
            <p className="text-[11px] text-[#71717A]">Passcodes are salted with 100,000 iterations and never stored in plaintext.</p>
          </div>
          <div className="rounded-xl border border-[#30303A] bg-[#141419] p-3 space-y-1">
            <span className="font-semibold text-[#F4F2FA]">Zero Frontend Authority</span>
            <p className="text-[11px] text-[#71717A]">Permissions are verified on every API request via SQLite session tokens.</p>
          </div>
          <div className="rounded-xl border border-[#30303A] bg-[#141419] p-3 space-y-1">
            <span className="font-semibold text-[#F4F2FA]">No Self-Approval</span>
            <p className="text-[11px] text-[#71717A]">Requesters cannot self-authorize venue bookings or disruption shifts.</p>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEMO_ACCOUNTS_INFO.map((account) => {
          const isCurrent = currentUser?.email === account.email;
          return (
            <div
              key={account.email}
              className={`rounded-2xl border p-5 shadow-sm transition-all space-y-4 ${
                isCurrent
                  ? "border-[#8B5CF6] bg-[#202027] shadow-lg shadow-[#8B5CF6]/10"
                  : "border-[#30303A] bg-[#19191F] hover:border-[#8B5CF6]/40"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white font-bold text-sm shadow-xs border border-[#A78BFA]/30">
                    {account.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#F4F2FA]">{account.name}</h4>
                      {isCurrent && (
                        <span className="rounded-full bg-emerald-950/80 text-[#34D399] border border-emerald-800/40 px-2 py-0.2 text-[9px] font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-[#A1A1AA]">{account.email}</span>
                  </div>
                </div>

                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${account.badgeColor}`}>
                  {account.badge}
                </span>
              </div>

              <div className="rounded-xl border border-[#30303A] bg-[#141419] p-3 space-y-1 text-xs">
                <div className="flex justify-between text-[#71717A]">
                  <span>Scope of Authority:</span>
                  <span className="font-mono text-[#A78BFA]">{account.role}</span>
                </div>
                <p className="text-[#F4F2FA] text-[11px] leading-relaxed">{account.scope}</p>
                {account.department && (
                  <div className="text-[10px] text-[#A1A1AA] pt-1">
                    Department: <span className="text-[#F4F2FA] font-semibold">{account.department}</span>
                  </div>
                )}
                {account.club && (
                  <div className="text-[10px] text-[#A1A1AA] pt-1">
                    Club: <span className="text-[#F4F2FA] font-semibold">{account.club}</span> (Quota: Max 3 Bookings)
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-xs text-[#71717A]">
                  <span>Password:</span>
                  <span className="font-mono text-[11px] font-bold text-[#A78BFA] bg-[#141419] px-2 py-0.5 rounded border border-[#30303A]">
                    {account.demoPassword}
                  </span>
                </div>

                {!isCurrent && (
                  <button
                    onClick={onOpenLogin}
                    className="rounded-lg border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-3 py-1 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer"
                  >
                    Log In as {account.badge}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
