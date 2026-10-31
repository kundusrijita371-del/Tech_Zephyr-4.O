"use client";

import React from "react";
import { API_BASE } from "@/lib/api";
import type { User } from "@/lib/types";
import {
  getNavItemsForRole,
  type NavTabId,
} from "@/lib/navigation";

export { type NavTabId } from "@/lib/navigation";

interface SidebarProps {
  currentUser: User | null;
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function getNavIcon(tabId: NavTabId, className?: string) {
  switch (tabId) {
    case "overview":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case "timetable":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "examinations":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "venues":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    case "rescheduling":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case "ai":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "analytics":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case "settings":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "users":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "faculty_groups":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case "availability":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "venue_request":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "booking_status":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
  }
}

export function Sidebar({
  currentUser,
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  // Dynamically obtain navigation items tailored to the user's backend-verified role
  const navItems = getNavItemsForRole(currentUser?.role);

  const getRoleBadgeStyle = (role: string | undefined) => {
    switch (role) {
      case "admin":
        return "bg-purple-950/80 text-purple-300 border-purple-800/60";
      case "department_coordinator":
        return "bg-blue-950/80 text-blue-300 border-blue-800/60";
      case "faculty":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800/60";
      case "club_representative":
        return "bg-amber-950/80 text-amber-300 border-amber-800/60";
      default:
        return "bg-[#292933] text-[#A1A1AA] border-[#30303A]";
    }
  };

  const getRoleDisplayTitle = (role: string | undefined) => {
    switch (role) {
      case "admin":
        return "Central Administration";
      case "department_coordinator":
        return "CSE Coordinator Workspace";
      case "faculty":
        return "Faculty Teaching Workspace";
      case "club_representative":
        return "Spectra Club Workspace";
      default:
        return "Guest Workspace";
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#141419] text-[#F4F2FA] transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } shadow-2xl lg:shadow-none border-r border-[#30303A]`}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between border-b border-[#30303A] px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B5CF6] via-[#7C3AED] to-[#4F46E5] font-bold text-white shadow-lg shadow-[#8B5CF6]/20 border border-[#A78BFA]/30">
              <span className="text-lg tracking-tight font-black">CIT</span>
            </div>
            <div>
              <div className="text-sm font-bold leading-tight text-[#F4F2FA] tracking-tight flex items-center gap-1.5">
                <span>CIT CAMPUS OS</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#A78BFA]" />
              </div>
              <div className="text-[11px] font-medium text-[#71717A]">
                Chilika Institute of Tech
              </div>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-[#71717A] hover:bg-[#292933] hover:text-[#F4F2FA] lg:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User Scope / Role Card */}
        <div className="p-4 pb-2 border-b border-[#30303A]/60">
          <div className="rounded-xl border border-[#30303A] bg-[#19191F] p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                Active Scope
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${getRoleBadgeStyle(currentUser?.role)}`}>
                {currentUser?.role?.toUpperCase().replace("_", " ") || "GUEST"}
              </span>
            </div>
            <div className="text-xs font-bold text-[#F4F2FA] truncate">
              {currentUser?.full_name || "Unauthenticated Guest"}
            </div>
            <div className="text-[10px] text-[#A1A1AA] truncate">
              {getRoleDisplayTitle(currentUser?.role)}
            </div>
          </div>
        </div>

        {/* Dynamic Navigation Modules */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
            Navigation Modules ({navItems.length})
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/40 font-semibold shadow-sm shadow-[#8B5CF6]/10"
                      : "text-[#A1A1AA] hover:bg-[#292933] hover:text-[#F4F2FA] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getNavIcon(
                      item.id,
                      `h-4.5 w-4.5 transition-colors ${
                        isActive
                          ? "text-[#A78BFA]"
                          : "text-[#71717A] group-hover:text-[#A78BFA]"
                      }`
                    )}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                        isActive
                          ? "bg-[#8B5CF6]/30 text-[#A78BFA] border border-[#8B5CF6]/40"
                          : "bg-[#202027] text-[#71717A] border border-[#30303A] group-hover:text-[#A1A1AA] group-hover:border-[#30303A]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-[#30303A] p-4">
          <div className="flex flex-col gap-1 rounded-xl bg-[#101014] border border-[#30303A] p-3 text-xs">
            <div className="flex items-center justify-between text-[#71717A]">
              <span className="text-[10px] uppercase tracking-wider font-semibold">Backend Engine</span>
              <span className="font-mono text-[10px] font-bold text-[#34D399] bg-[#34D399]/10 px-1.5 py-0.2 rounded border border-[#34D399]/20">FastAPI</span>
            </div>
            <div className="truncate font-mono text-[10px] text-[#A1A1AA] mt-0.5">
              {API_BASE}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
