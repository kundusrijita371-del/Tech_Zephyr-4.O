"use client";

import React, { useState } from "react";

const CSE_GROUPS = [
  { id: "CSE-1", name: "Computer Science - Section 1", year: 1, size: 60, room: "CR-101", weeklyHours: 24 },
  { id: "CSE-2", name: "Computer Science - Section 2", year: 2, size: 60, room: "CR-102", weeklyHours: 26 },
  { id: "CSE-3", name: "Computer Science - Section 3", year: 3, size: 60, room: "CR-103", weeklyHours: 22 },
];

const CSE_FACULTY = [
  { id: "F-CSE-01", name: "Dr. Rajesh Sharma", role: "Professor & Coord", courses: ["CS301 (Data Structures)", "CS401 (Algorithms)"], maxHoursDay: 4, weeklyTeachingHours: 14 },
  { id: "F-CSE-02", name: "Prof. Priya Verma", role: "Associate Professor", courses: ["CS201 (OOP with Java)", "CS302 (DBMS)"], maxHoursDay: 4, weeklyTeachingHours: 16 },
  { id: "F-CSE-03", name: "Dr. Arvind Rao", role: "Assistant Professor", courses: ["CS101 (Intro to Programming)", "CS203 (Discrete Math)"], maxHoursDay: 4, weeklyTeachingHours: 12 },
  { id: "F-CSE-04", name: "Prof. Meera Sen", role: "Assistant Professor", courses: ["CS305 (Operating Systems)", "CS403 (Compiler Design)"], maxHoursDay: 4, weeklyTeachingHours: 15 },
  { id: "F-CSE-05", name: "Dr. Amit Patel", role: "Lab Instructor", courses: ["CS-LAB-1 (OS Lab)", "CS-LAB-2 (Algorithms Lab)"], maxHoursDay: 4, weeklyTeachingHours: 18 },
];

export function CoordinatorFacultyGroupsView() {
  const [activeTab, setActiveTab] = useState<"groups" | "faculty">("groups");

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#30303A] bg-[#19191F] p-6 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-blue-400" />
            <h2 className="text-xl font-bold tracking-tight text-[#F4F2FA]">
              CSE Faculty &amp; Student Groups Roster
            </h2>
          </div>
          <p className="text-xs text-[#A1A1AA]">
            Departmental teaching workloads, student cohorts, and synchronized lab resources for Computer Science &amp; Engineering.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-[#30303A] bg-[#141419] p-1">
          <button
            onClick={() => setActiveTab("groups")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "groups"
                ? "bg-[#8B5CF6] text-white shadow-xs"
                : "text-[#A1A1AA] hover:text-[#F4F2FA]"
            }`}
          >
            Student Cohorts (3)
          </button>
          <button
            onClick={() => setActiveTab("faculty")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "faculty"
                ? "bg-[#8B5CF6] text-white shadow-xs"
                : "text-[#A1A1AA] hover:text-[#F4F2FA]"
            }`}
          >
            Faculty Workloads (5)
          </button>
        </div>
      </div>

      {/* Cohorts View */}
      {activeTab === "groups" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CSE_GROUPS.map((group) => (
            <div
              key={group.id}
              className="rounded-2xl border border-[#30303A] bg-[#19191F] p-5 shadow-sm space-y-4 hover:border-[#8B5CF6]/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#F4F2FA]">{group.id}</h3>
                  <span className="text-[11px] text-[#A1A1AA]">{group.name}</span>
                </div>
                <span className="rounded-full bg-purple-950/60 border border-purple-800/40 px-2.5 py-0.5 text-[10px] font-bold text-[#A78BFA]">
                  Year {group.year}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-[#30303A] bg-[#202027] p-2.5 text-center">
                  <span className="text-[10px] text-[#71717A] uppercase font-semibold">Cohort Size</span>
                  <p className="text-lg font-bold text-[#F4F2FA]">{group.size}</p>
                </div>
                <div className="rounded-xl border border-[#30303A] bg-[#202027] p-2.5 text-center">
                  <span className="text-[10px] text-[#71717A] uppercase font-semibold">Home Venue</span>
                  <p className="text-lg font-bold text-[#34D399]">{group.room}</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#30303A] bg-[#141419] p-3 text-xs space-y-1">
                <div className="flex justify-between text-[#71717A]">
                  <span>Weekly Sessions:</span>
                  <span className="font-mono text-[#F4F2FA]">{group.weeklyHours} hours</span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>Lab Sync:</span>
                  <span className="text-[#34D399] font-semibold">CS Lab 1 &amp; 2</span>
                </div>
                <div className="flex justify-between text-[#71717A]">
                  <span>Electives:</span>
                  <span className="text-[#A78BFA]">OE301–OE303 Basket</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Faculty View */}
      {activeTab === "faculty" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CSE_FACULTY.map((fac) => (
            <div
              key={fac.id}
              className="rounded-2xl border border-[#30303A] bg-[#19191F] p-5 shadow-sm space-y-3 hover:border-[#8B5CF6]/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#F4F2FA]">{fac.name}</h4>
                  <span className="text-xs text-[#A1A1AA]">{fac.role}</span>
                </div>
                <span className="font-mono text-[10px] text-[#71717A] bg-[#141419] px-2 py-0.5 rounded border border-[#30303A]">
                  {fac.id}
                </span>
              </div>

              <div className="rounded-xl border border-[#30303A] bg-[#202027] p-3 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-[#71717A]">Assigned Courses</span>
                <div className="space-y-1">
                  {fac.courses.map((c, i) => (
                    <div key={i} className="text-[#F4F2FA] font-mono text-[11px] bg-[#141419] p-1.5 rounded border border-[#30303A]/60">
                      {c}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#A1A1AA] pt-1">
                <span>Daily Max Teaching Cap: <strong className="text-[#34D399]">{fac.maxHoursDay}h/day</strong></span>
                <span>Weekly Load: <strong className="text-[#A78BFA]">{fac.weeklyTeachingHours}h</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
