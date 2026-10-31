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
    iconBg: "bg-blue-950/60 border border-blue-800/40",
    iconColor: "text-blue-400",
    badgeBg: "bg-blue-950/60 border border-blue-800/50",
    badgeText: "text-blue-300",
    accentBorder: "hover:border-blue-500/50",
  },
  emerald: {
    iconBg: "bg-emerald-950/60 border border-emerald-800/40",
    iconColor: "text-[#34D399]",
    badgeBg: "bg-emerald-950/60 border border-emerald-800/50",
    badgeText: "text-emerald-300",
    accentBorder: "hover:border-[#34D399]/50",
  },
  indigo: {
    iconBg: "bg-indigo-950/60 border border-indigo-800/40",
    iconColor: "text-indigo-400",
    badgeBg: "bg-indigo-950/60 border border-indigo-800/50",
    badgeText: "text-indigo-300",
    accentBorder: "hover:border-indigo-500/50",
  },
  amber: {
    iconBg: "bg-amber-950/60 border border-amber-800/40",
    iconColor: "text-[#FBBF24]",
    badgeBg: "bg-amber-950/60 border border-amber-800/50",
    badgeText: "text-amber-300",
    accentBorder: "hover:border-[#FBBF24]/50",
  },
  purple: {
    iconBg: "bg-purple-950/60 border border-purple-800/40",
    iconColor: "text-[#A78BFA]",
    badgeBg: "bg-purple-950/60 border border-purple-800/50",
    badgeText: "text-purple-300",
    accentBorder: "hover:border-[#A78BFA]/50",
  },
  rose: {
    iconBg: "bg-rose-950/60 border border-rose-800/40",
    iconColor: "text-[#FB7185]",
    badgeBg: "bg-rose-950/60 border border-rose-800/50",
    badgeText: "text-rose-300",
    accentBorder: "hover:border-[#FB7185]/50",
  },
  teal: {
    iconBg: "bg-teal-950/60 border border-teal-800/40",
    iconColor: "text-teal-400",
    badgeBg: "bg-teal-950/60 border border-teal-800/50",
    badgeText: "text-teal-300",
    accentBorder: "hover:border-teal-500/50",
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
      className={`group relative overflow-hidden rounded-2xl border border-[#30303A] bg-[#202027] p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 ${styles.accentBorder}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA]">
            {title}
          </span>
          <div className="flex items-baseline gap-2">
            {loading ? (
              <div className="h-9 w-20 animate-pulse rounded-md bg-[#292933]" />
            ) : (
              <span className="text-3xl font-extrabold tracking-tight text-[#F4F2FA] font-mono">
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
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${styles.iconBg} ${styles.iconColor} transition-transform group-hover:scale-105 shadow-sm`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-[#71717A] border-t border-[#30303A] pt-3">
        {description}
      </p>
    </div>
  );
}
