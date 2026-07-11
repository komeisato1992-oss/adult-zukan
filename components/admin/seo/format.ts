export function formatSeoNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}

export function formatSeoPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatSeoPosition(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return value.toFixed(1);
}

export function formatSeoDateTime(iso: string | null): string {
  if (!iso) return "未取得";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSeoDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
  });
}

export { SEO_PAGE_TYPE_LABELS } from "@/lib/admin/seo-types";

export function formatSeoChangePercent(value: number | null): string {
  if (value === null) return "新規";
  if (value === 0) return "±0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatSeoCtrPoints(current: number, previous: number): string {
  const delta = (current - previous) * 100;
  if (Math.abs(delta) < 0.005) return "±0.0pt";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}pt`;
}

export function formatSeoPositionDelta(current: number, previous: number): string {
  if (current <= 0 || previous <= 0) return "—";
  const delta = previous - current;
  if (Math.abs(delta) < 0.05) return "変化なし";
  if (delta > 0) return `${delta.toFixed(1)}改善`;
  return `${Math.abs(delta).toFixed(1)}悪化`;
}
