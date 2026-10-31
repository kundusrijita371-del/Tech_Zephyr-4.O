"use client";

import React, { useEffect, useRef, useState } from "react";
import { getAssistantHealth, sendAssistantChat } from "@/lib/api";
import type {
  AssistantChatResponseData,
  AssistantHealthData,
} from "@/lib/types";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  data?: AssistantChatResponseData;
}

const STARTER_PROMPTS = [
  { label: "Seminar Hall (English)", text: "Find me a seminar hall for 60 students tomorrow at 2 PM." },
  { label: "Seminar Hall (Hinglish)", text: "Kal 2 baje 60 students ke liye seminar hall chahiye." },
  { label: "Timetable CSE-3", text: "Show today's timetable for CSE-3." },
  { label: "BR-04 Rejection", text: "Why was my booking BR-04 rejected?" },
  { label: "Faculty Workload", text: "Which faculty members have the most classes this week?" },
  { label: "Physics Midsem", text: "When is the Physics midsem?" },
  { label: "CR-102 Outage", text: "What happens if Room CR-102 becomes unavailable?" },
];

interface AIAssistantViewProps {
  authenticatedRole?: string;
}

export function AIAssistantView({ authenticatedRole }: AIAssistantViewProps = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: "Hello! I am the CIT Campus Scheduling AI Assistant. I can interpret inquiries in English and Hinglish, check venue availability, look up timetable and exam schedules, explain booking decisions, and simulate hypothetical disruptions.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>(authenticatedRole || "faculty");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [health, setHealth] = useState<AssistantHealthData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authenticatedRole) {
      setUserRole(authenticatedRole);
    }
  }, [authenticatedRole]);


  useEffect(() => {
    getAssistantHealth()
      .then(setHealth)
      .catch(() => null);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (messageToSend?: string) => {
    const text = (messageToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await sendAssistantChat({
        message: text,
        conversation_id: conversationId,
        user_role: userRole,
      });

      setConversationId(response.conversation_id);

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: "assistant",
        text: response.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        data: response,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text:
          err instanceof Error
            ? `Error: ${err.message}`
            : "Sorry, I encountered an error while processing your request. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[550px] max-w-5xl mx-auto rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-3.5 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              CIT Campus AI Assistant
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                English & Hinglish
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Provider: <span className="font-mono text-slate-700">{health?.provider || "deterministic_fallback"}</span> • Model: <span className="font-mono text-slate-700">{health?.model || "active"}</span>
            </p>
          </div>
        </div>

        {/* User Role Selector */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-500 text-[11px]">Active Role:</span>
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs focus:border-blue-500 focus:outline-none"
          >
            <option value="faculty">Faculty Member</option>
            <option value="admin">Administrator (Dean)</option>
            <option value="club">Club Representative</option>
            <option value="department_coordinator">Dept Coordinator</option>
          </select>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="border-b border-slate-100 bg-white px-6 py-2.5 overflow-x-auto scrollbar-none flex items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
          Try Asking:
        </span>
        {STARTER_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(p.text)}
            className="rounded-full border border-slate-200/80 bg-slate-50/80 hover:bg-blue-50 hover:border-blue-200 px-3 py-1 text-[11px] font-medium text-slate-600 hover:text-blue-700 transition shrink-0"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chat Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <span className="text-[10px] font-semibold text-slate-400">
                {msg.sender === "user" ? "You" : "CIT Assistant"}
              </span>
              <span className="text-[10px] text-slate-300">• {msg.timestamp}</span>
            </div>

            <div
              className={`max-w-2xl rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs whitespace-pre-wrap ${
                msg.sender === "user"
                  ? "bg-slate-900 text-white rounded-br-none"
                  : "bg-white border border-slate-200/90 text-slate-800 rounded-bl-none"
              }`}
            >
              {msg.text}

              {/* Clarification Box */}
              {Boolean(msg.data?.requires_clarification && msg.data.clarification_question) && (
                <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                  <svg className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-semibold">Missing Information Needed:</div>
                    <div>{msg.data?.clarification_question}</div>
                  </div>
                </div>
              )}

              {/* Action Result: Available Rooms Card */}
              {Boolean(msg.data?.action_result && Array.isArray((msg.data.action_result as Record<string, unknown>).available_rooms)) && (
                <div className="mt-3 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Available Venue Options ({((msg.data!.action_result as Record<string, unknown>).available_rooms as Array<Record<string, unknown>>).length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {((msg.data!.action_result as Record<string, unknown>).available_rooms as Array<Record<string, unknown>>).slice(0, 4).map((r, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-[11px]">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span className="font-mono text-blue-700">{String(r.room_id)}</span>
                          <span className="text-[10px] text-slate-500">Cap: {String(r.capacity)}</span>
                        </div>
                        <div className="text-slate-600 text-[10px] mt-0.5">{String(r.name)} • {String(r.building)}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-500">
                          <span className="rounded bg-white px-1.5 py-0.5 border border-slate-200">{String(r.type)}</span>
                          {Boolean(r.accessible) && <span className="text-emerald-700 font-semibold">Accessible</span>}
                          {Boolean(r.projector) && <span>• Projector</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Result: Timetable Schedule Table */}
              {Boolean(msg.data?.action_result && Array.isArray((msg.data.action_result as Record<string, unknown>).classes)) && (
                <div className="mt-3 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Scheduled Classes ({((msg.data!.action_result as Record<string, unknown>).classes as Array<Record<string, unknown>>).length})
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                        <tr>
                          <th className="px-2.5 py-1.5">Course</th>
                          <th className="px-2.5 py-1.5">Day & Period</th>
                          <th className="px-2.5 py-1.5">Room</th>
                          <th className="px-2.5 py-1.5">Faculty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {((msg.data!.action_result as Record<string, unknown>).classes as Array<Record<string, unknown>>).slice(0, 6).map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="px-2.5 py-1.5 font-bold text-slate-900">{String(c.course_id)}</td>
                            <td className="px-2.5 py-1.5 font-mono text-blue-700">{String(c.day)}-P{String(c.start_period)}</td>
                            <td className="px-2.5 py-1.5 font-mono">{String(c.room_id)}</td>
                            <td className="px-2.5 py-1.5 text-slate-600 font-mono">{String(c.faculty_id)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Result: Faculty Workload Leaderboard */}
              {Boolean(msg.data?.action_result && Array.isArray((msg.data.action_result as Record<string, unknown>).top_faculty)) && (
                <div className="mt-3 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Weekly Faculty Teaching Workload
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {((msg.data!.action_result as Record<string, unknown>).top_faculty as Array<Record<string, unknown>>).map((f, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-center text-[11px]">
                        <div className="font-bold font-mono text-slate-900">{String(f.faculty_id)}</div>
                        <div className="text-sm font-extrabold text-blue-600 font-mono mt-0.5">{String(f.hours)} hrs</div>
                        <div className="text-[9px] text-slate-400 uppercase">Teaching load</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Result: Disruption Preview Banner */}
              {Boolean(msg.data?.action_result && (msg.data.action_result as Record<string, unknown>).proposal_id) && (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between font-bold text-blue-900">
                    <span>Hypothetical Disruption Preview</span>
                    <span className="rounded bg-blue-200/80 px-2 py-0.5 text-[10px] text-blue-800">
                      Solver: {String((msg.data!.action_result as Record<string, unknown>).solver_status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-white p-1.5 border border-blue-100">
                      <div className="text-[9px] text-slate-500 uppercase">Moved</div>
                      <div className="font-bold text-slate-900">{String((msg.data!.action_result as Record<string, unknown>).sessions_moved)}</div>
                    </div>
                    <div className="rounded bg-white p-1.5 border border-blue-100">
                      <div className="text-[9px] text-slate-500 uppercase">Room-Only</div>
                      <div className="font-bold text-emerald-600">{String((msg.data!.action_result as Record<string, unknown>).room_only_changes)}</div>
                    </div>
                    <div className="rounded bg-white p-1.5 border border-blue-100">
                      <div className="text-[9px] text-slate-500 uppercase">Hard Clashes</div>
                      <div className="font-bold text-emerald-700">0</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-blue-800 italic">
                    Simulation only. Active schedule has not been modified.
                  </p>
                </div>
              )}

              {/* Follow-up Suggested Actions */}
              {Boolean(msg.data?.suggested_actions && msg.data.suggested_actions.length > 0) && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                  {msg.data!.suggested_actions.map((act, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSend(act)}
                      className="rounded-full bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 px-2.5 py-0.5 text-[10px] font-medium transition"
                    >
                      {act} →
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span>Assistant is reasoning with campus constraint engine...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="border-t border-slate-100 bg-white p-4"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type in English or Hinglish (e.g., 'Kal 2 baje 60 students ke liye seminar hall chahiye')..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>Send</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
