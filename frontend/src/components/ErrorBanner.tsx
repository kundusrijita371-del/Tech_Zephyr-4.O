"use client";

import React from "react";
import { API_BASE } from "@/lib/api";

interface ErrorBannerProps {
  errorMessage: string;
  onRetry: () => void;
  isRetrying: boolean;
}

export function ErrorBanner({
  errorMessage,
  onRetry,
  isRetrying,
}: ErrorBannerProps) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-rose-900 shadow-xs">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-rose-950">
              Backend Connection Required
            </h3>
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              <svg
                className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`}
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
              <span>{isRetrying ? "Retrying..." : "Retry Connection"}</span>
            </button>
          </div>

          <p className="text-xs text-rose-800 leading-relaxed">
            Could not retrieve dataset statistics from the FastAPI backend at{" "}
            <code className="rounded bg-rose-100/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-rose-900">
              {API_BASE}
            </code>
            . As mandated by development rules, fallback fake data is strictly prohibited.
          </p>

          <div className="rounded-lg bg-rose-900/10 p-3 text-xs font-mono text-rose-950 space-y-1">
            <div className="text-[11px] font-sans font-semibold text-rose-900">
              To start the backend server, execute in your terminal:
            </div>
            <div className="text-[11px] bg-rose-950 text-rose-50 p-2 rounded select-all">
              cd backend ; .venv\Scripts\uvicorn app.main:app --reload
            </div>
            <div className="text-[10px] text-rose-700 font-sans mt-1">
              Details: {errorMessage}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

