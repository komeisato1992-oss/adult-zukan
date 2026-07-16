import type { OverviewTone } from "@/components/admin/works-cms/types";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return value;
  return new Date(t).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}秒`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}分${rem}秒`;
}

export function estimateSyncEta(
  targetCount: number,
  etaPerThousandSec: number,
): string {
  if (targetCount <= 0) return "—";
  const sec = Math.max(30, Math.round((targetCount / 1000) * etaPerThousandSec));
  if (sec < 60) return `約${sec}秒`;
  const min = Math.ceil(sec / 60);
  return `約${min}分`;
}

export function toneCardClass(tone: OverviewTone | "info"): string {
  if (tone === "ok") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  if (tone === "running" || tone === "info")
    return "border-sky-300 bg-sky-50 text-sky-950";
  if (tone === "warn") return "border-amber-300 bg-amber-50 text-amber-950";
  if (tone === "error") return "border-red-300 bg-red-50 text-red-950";
  return "border-zinc-300 bg-zinc-100 text-zinc-800";
}

export function toneDotClass(tone: OverviewTone | "info"): string {
  if (tone === "ok") return "bg-emerald-500";
  if (tone === "running" || tone === "info") return "bg-sky-500";
  if (tone === "warn") return "bg-amber-500";
  if (tone === "error") return "bg-red-500";
  return "bg-zinc-400";
}
