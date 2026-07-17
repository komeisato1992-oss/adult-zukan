"use client";

import { computeChangePercent } from "@/lib/admin/seo-insights";
import {
  changeTone,
  formatSeoChangePercent,
} from "@/components/admin/ops/OpsShared";

type DashboardKpiCardProps = {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  invert?: boolean;
  changeLabel?: string;
  hint?: string;
};

function changeSymbol(tone: "up" | "down" | "neutral"): string {
  if (tone === "up") return "↑";
  if (tone === "down") return "↓";
  return "→";
}

export function DashboardKpiCard({
  label,
  value,
  current,
  previous,
  invert = false,
  changeLabel = "前期間比",
  hint,
}: DashboardKpiCardProps) {
  const change =
    current != null && previous != null
      ? computeChangePercent(current, previous)
      : null;
  const tone = changeTone(change, invert);
  const toneClass =
    tone === "up"
      ? "text-green-700"
      : tone === "down"
        ? "text-red-700"
        : "text-muted";

  return (
    <div className="flex h-full min-h-[108px] min-w-0 flex-col rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 break-words text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
        {value}
      </p>
      {change != null ? (
        <p className={`mt-auto pt-2 text-xs font-semibold ${toneClass}`}>
          <span aria-hidden>{changeSymbol(tone)} </span>
          {changeLabel} {formatSeoChangePercent(change)}
        </p>
      ) : hint ? (
        <p className="mt-auto pt-2 text-xs text-muted">{hint}</p>
      ) : (
        <div className="mt-auto pt-2" />
      )}
    </div>
  );
}
