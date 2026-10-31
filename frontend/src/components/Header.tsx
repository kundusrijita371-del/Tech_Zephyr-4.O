"use client";

import React from "react";
import { API_BASE } from "@/lib/api";

interface HeaderProps {
  onToggleMobile: () => void;
  datasetId?: string;
  isConnected: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  activeTabLabel: string;
}

export function Header({
  onToggleMobile,
  datasetId = "cit-public-v1",
  isConnected,
  isRefreshing,
  onRefresh,
  activeTabLabel,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-8 backdrop-blur-md">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onToggleMobile}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
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

      {/* Right: Status Indicators & Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Dataset ID Badge */}
        <div className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
          <span className="text-slate-600 font-mono">Dataset:</span>
          <span className="font-mono font-semibold text-blue-700">{datasetId}</span>
        </div>

        {/* Backend Connection Status Badge */}
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
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
          <span className="hidden sm:inline">
            {isConnected ? "Backend Connected" : "Backend Offline"}
          </span>
          <span className="sm:hidden">{isConnected ? "Online" : "Offline"}</span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
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
          <span className="hidden md:inline">
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </span>
        </button>
      </div>
    </header>
  );
}

