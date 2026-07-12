"use client";

import type { ReactNode } from "react";
import { computeChangePercent } from "@/lib/admin/seo-insights";
import {
  formatSeoChangePercent,
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
} from "@/components/admin/seo/format";

export function changeTone(
  change: number | null,
  invert = false,
): "up" | "down" | "neutral" {
  if (change == null || change === 0) return "neutral";
  const positiveIsGood = !invert;
  const isUp = change > 0;
  if (positiveIsGood) return isUp ? "up" : "down";
  return isUp ? "down" : "up";
}

export function ChangeBadge({
  current,
  previous,
  invert = false,
  label,
}: {
  current: number;
  previous: number;
  invert?: boolean;
  label: string;
}) {
  const change = computeChangePercent(current, previous);
  const tone = changeTone(change, invert);
  const toneClass =
    tone === "up"
      ? "text-green-600"
      : tone === "down"
        ? "text-red-600"
        : "text-muted";

  return (
    <p className={`text-xs font-medium ${toneClass}`}>
      {label}: {formatSeoChangePercent(change)}
    </p>
  );
}

export function OpsKpiCard({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {children ? <div className="mt-2 space-y-1">{children}</div> : null}
    </div>
  );
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}分${rest}秒`;
}

export function formatYen(value: number): string {
  return `¥${formatSeoNumber(Math.round(value))}`;
}

export {
  formatSeoNumber,
  formatSeoPercent,
  formatSeoPosition,
  formatSeoChangePercent,
};
