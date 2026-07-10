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

export const SEO_PAGE_TYPE_LABELS: Record<string, string> = {
  work: "作品",
  actress: "女優",
  maker: "メーカー",
  genre: "ジャンル",
  series: "シリーズ",
  label: "レーベル",
  ranking: "ランキング",
  other: "その他",
};
