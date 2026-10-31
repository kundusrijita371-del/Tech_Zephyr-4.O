"use client";

import React from "react";

export type CardColorTheme =
  | "blue"
  | "emerald"
  | "indigo"
  | "amber"
  | "purple"
  | "rose"
  | "teal";

interface StatCardProps {
  title: string;
  value: number | string | undefined;
  badge?: string;
  description: string;
  theme?: CardColorTheme;
  icon: (props: { className?: string }) => React.ReactElement;
  loading?: boolean;
}

const THEME_STYLES: Record<
  CardColorTheme,
  {
    iconBg: string;
    iconColor: string;
    badgeBg: string;
    badgeText: string;
    accentBorder: string;
  }
> = {
  blue: {
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    accentBorder: "hover:border-blue-300",
  },
  emerald: {
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    accentBorder: "hover:border-emerald-300",
  },
  indigo: {
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    accentBorder: "hover:border-indigo-300",
  },
  amber: {
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    accentBorder: "hover:border-amber-300",
  },
  purple: {
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    accentBorder: "hover:border-purple-300",
  },
  rose: {
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    accentBorder: "hover:border-rose-300",
  },
  teal: {
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
    badgeBg: "bg-teal-50",
    badgeText: "text-teal-700",
    accentBorder: "hover:border-teal-300",
  },
};

export function StatCard({
  title,
  value,
  badge,
  description,
  theme = "blue",
  icon: Icon,
  loading = false,
}: StatCardProps) {
  const styles = THEME_STYLES[theme];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${styles.accentBorder}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          <div className="flex items-baseline gap-2">
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded-md bg-slate-200" />
            ) : (
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                {value ?? "—"}
              </span>
            )}
            {badge && !loading && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badgeBg} ${styles.badgeText}`}
              >
                {badge}
              </span>
            )}
          </div>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${styles.iconBg} ${styles.iconColor} transition-transform group-hover:scale-105`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500 border-t border-slate-100 pt-3">
        {description}
      </p>
    </div>
  );
}

