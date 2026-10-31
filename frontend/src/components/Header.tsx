"use client";

import React from "react";
import { API_BASE } from "@/lib/api";
import type { User } from "@/lib/types";

interface HeaderProps {
  onToggleMobile: () => void;
  datasetId?: string;
  isConnected: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  activeTabLabel: string;
  currentUser: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export function Header({
  onToggleMobile,
  datasetId = "cit-public-v1",
  isConnected,
  isRefreshing,
  onRefresh,
  activeTabLabel,
  currentUser,
  onOpenLogin,
  onLogout,
}: HeaderProps) {
  // Role styling helper
  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "department_coordinator":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "faculty":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "club_representative":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "department_coordinator":
        return "Coordinator";
      case "faculty":
        return "Faculty";
      case "club_representative":
        return "Club Lead";
      default:
        return role;
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-8 backdrop-blur-md">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onToggleMobile}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden cursor-pointer"
          aria-label="Open sidebar"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>CIT Portal</span>
            <span>/</span>
            <span className="text-blue-600 font-semibold">{activeTabLabel}</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            Campus Administration Dashboard
          </h1>
        </div>
      </div>

      {/* Right: User Profile, Status Indicators & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dataset ID Badge */}
        <div className="hidden xl:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
          <span className="text-slate-600 font-mono">Dataset:</span>
          <span className="font-mono font-semibold text-blue-700">{datasetId}</span>
        </div>

        {/* Backend Connection Status Badge */}
        <div
          className={`hidden sm:flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            isConnected
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
          title={`Backend API at ${API_BASE}`}
        >
          <span className="relative flex h-2 w-2">
            {isConnected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                isConnected ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
          </span>
          <span>{isConnected ? "Connected" : "Offline"}</span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          title="Reload dataset statistics from backend"
        >
          <svg
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-blue-600" : "text-slate-500"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="hidden lg:inline">{isRefreshing ? "..." : "Refresh"}</span>
        </button>

        {/* User Account / Judge Demo Login Pill */}
        {currentUser ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:shadow-xs p-1.5 pr-3 transition-all cursor-pointer"
              title="Click to switch between Judge Demo Accounts"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs">
                {currentUser.full_name.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 leading-none">
                    {currentUser.full_name.split(" ")[0]}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${getRoleBadgeStyle(currentUser.role)}`}>
                    {getRoleLabel(currentUser.role)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono leading-none mt-0.5">
                  {currentUser.department || currentUser.club || "Campus"}
                </div>
              </div>
            </button>

            <button
              onClick={onLogout}
              className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            <span>Judge Demo Login</span>
          </button>
        )}
      </div>
    </header>
  );
}
