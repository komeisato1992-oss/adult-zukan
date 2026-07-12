import type { SeoSitemapStatusSnapshot } from "@/lib/admin/seo-types";
import type { GscSitemapSummary } from "@/lib/admin/seo-sitemap-gsc-summary";

/** @deprecated サイト側エンティティ行の件数。GSC送信済み件数には使わない */
export function countSubmittedSitemaps(
  snapshot: SeoSitemapStatusSnapshot,
): { submitted: number; total: number } {
  const total = snapshot.rows.length;
  const submitted = snapshot.rows.filter(
    (row) => row.status === "success",
  ).length;
  return { submitted, total };
}

export function formatSitemapKpiValue(summary: GscSitemapSummary): string {
  switch (summary.state) {
    case "loading":
      return "取得中";
    case "unavailable":
      return "未設定";
    case "error":
      return "取得失敗";
    case "success_empty":
      return "送信済み 0件";
    case "success_with_data":
      return `送信済み ${summary.gscSubmittedCount}件`;
  }
}

export function formatSitemapKpiSubLabel(summary: GscSitemapSummary): string {
  if (summary.state === "success_with_data") {
    return `正常 ${summary.healthyCount} / 警告 ${summary.warningCount} / エラー ${summary.errorCount}`;
  }
  if (summary.state === "success_empty") {
    return `サイト側生成：${summary.siteGeneratedCount}件`;
  }
  return "Search Console";
}
