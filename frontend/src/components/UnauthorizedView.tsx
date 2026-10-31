"use client";

import React from "react";
import type { User } from "@/lib/types";
import { type NavTabId } from "@/lib/navigation";

interface UnauthorizedViewProps {
  attemptedTab: NavTabId;
  currentUser: User | null;
  onReturnDashboard: () => void;
  onOpenLogin: () => void;
}

export function UnauthorizedView({
  attemptedTab,
  currentUser,
  onReturnDashboard,
  onOpenLogin,
}: UnauthorizedViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-6 text-center animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl border border-rose-900/60 bg-gradient-to-b from-[#19191F] to-[#141419] p-8 shadow-2xl space-y-6">
        {/* Warning Icon with Amber/Rose Ring */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-950/60 border border-rose-800/60 text-[#FB7185] shadow-lg shadow-rose-900/30">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <div className="space-y-2">
          <span className="rounded-full bg-rose-950 border border-rose-800/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FB7185]">
            Access Restricted (HTTP 403)
          </span>
          <h2 className="text-xl font-bold tracking-tight text-[#F4F2FA]">
            Authorization Required
          </h2>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            Your current account role{" "}
            <span className="font-semibold text-[#A78BFA]">
              ({currentUser?.role?.replace("_", " ").toUpperCase() || "UNAUTHENTICATED GUEST"})
            </span>{" "}
            is not authorized to view the{" "}
            <span className="font-mono text-[#F4F2FA]">[{attemptedTab}]</span> module.
          </p>
        </div>

        <div className="rounded-xl border border-[#30303A] bg-[#101014] p-4 text-left text-xs text-[#71717A] space-y-1.5">
          <div className="flex items-center gap-2 text-[#A1A1AA] font-semibold">
            <svg className="h-4 w-4 text-[#FB7185]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>CIT Campus OS Security Policy</span>
          </div>
          <p className="text-[11px] text-[#A1A1AA]">
            Modules such as full timetable solver generation, exam allocation grids, and system settings require elevated institutional privileges.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onReturnDashboard}
            className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#8B5CF6]/30 transition-all cursor-pointer"
          >
            Return to My Dashboard
          </button>
          <button
            onClick={onOpenLogin}
            className="w-full sm:w-auto rounded-xl border border-[#30303A] bg-[#202027] hover:bg-[#292933] px-4 py-2.5 text-xs font-semibold text-[#F4F2FA] transition-all cursor-pointer"
          >
            Switch to Authorized Demo Account
          </button>
        </div>
      </div>
    </div>
  );
}
