import type { SeoSitemapRow } from "@/lib/admin/seo-types";
import { buildSitemapDefinitions } from "@/lib/sitemap/definitions";

export type GscSitemapFetchState =
  | "loading"
  | "success_with_data"
  | "success_empty"
  | "error"
  | "unavailable";

export type GscSitemapHealth =
  | "ok"
  | "warning"
  | "error"
  | "pending"
  | "fetch_failed";

export type GscSitemapSummary = {
  state: GscSitemapFetchState;
  message: string;
  fetchedAt: string | null;
  gscSubmittedCount: number;
  siteGeneratedCount: number;
  healthyCount: number;
  warningCount: number;
  errorCount: number;
  pendingCount: number;
  detectedUrlCount: number;
  detectedVideoCount: number;
  fetchError?: string;
};

export function classifyGscSitemapRow(row: SeoSitemapRow): GscSitemapHealth {
  if (row.errors > 0) return "error";
  if (row.isPending) return "pending";
  if (row.warnings > 0) return "warning";
  return "ok";
}

export function gscSitemapHealthLabel(health: GscSitemapHealth): string {
  switch (health) {
    case "ok":
      return "正常";
    case "warning":
      return "警告あり";
    case "error":
      return "エラーあり";
    case "pending":
      return "処理中";
    case "fetch_failed":
      return "取得失敗";
  }
}

export function buildGscSitemapSummary(input: {
  configured: boolean;
  sitemaps: SeoSitemapRow[];
  fetchedAt: string | null;
  fetchError?: string | null;
  worksCount?: number;
  siteUrl?: string;
  loading?: boolean;
}): GscSitemapSummary {
  const siteGeneratedCount = buildSitemapDefinitions({
    siteUrl: input.siteUrl,
    worksCount: input.worksCount ?? 0,
  }).length;

  if (input.loading) {
    return {
      state: "loading",
      message: "サイトマップ情報を取得しています",
      fetchedAt: input.fetchedAt,
      gscSubmittedCount: 0,
      siteGeneratedCount,
      healthyCount: 0,
      warningCount: 0,
      errorCount: 0,
      pendingCount: 0,
      detectedUrlCount: 0,
      detectedVideoCount: 0,
    };
  }

  if (!input.configured) {
    return {
      state: "unavailable",
      message:
        "Search Consoleの設定が完了していないため、サイトマップ情報を取得できません",
      fetchedAt: null,
      gscSubmittedCount: 0,
      siteGeneratedCount,
      healthyCount: 0,
      warningCount: 0,
      errorCount: 0,
      pendingCount: 0,
      detectedUrlCount: 0,
      detectedVideoCount: 0,
    };
  }

  if (input.fetchError) {
    return {
      state: "error",
      message: "サイトマップ情報の取得に失敗しました",
      fetchedAt: input.fetchedAt,
      gscSubmittedCount: 0,
      siteGeneratedCount,
      healthyCount: 0,
      warningCount: 0,
      errorCount: 0,
      pendingCount: 0,
      detectedUrlCount: 0,
      detectedVideoCount: 0,
      fetchError: input.fetchError,
    };
  }

  const rows = input.sitemaps;
  if (input.fetchedAt && rows.length === 0) {
    return {
      state: "success_empty",
      message: "Search Consoleに送信済みのサイトマップがありません",
      fetchedAt: input.fetchedAt,
      gscSubmittedCount: 0,
      siteGeneratedCount,
      healthyCount: 0,
      warningCount: 0,
      errorCount: 0,
      pendingCount: 0,
      detectedUrlCount: 0,
      detectedVideoCount: 0,
    };
  }

  if (rows.length === 0) {
    return {
      state: "loading",
      message: "サイトマップ情報を取得しています",
      fetchedAt: input.fetchedAt,
      gscSubmittedCount: 0,
      siteGeneratedCount,
      healthyCount: 0,
      warningCount: 0,
      errorCount: 0,
      pendingCount: 0,
      detectedUrlCount: 0,
      detectedVideoCount: 0,
    };
  }

  let healthyCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let pendingCount = 0;
  let detectedUrlCount = 0;
  let detectedVideoCount = 0;

  for (const row of rows) {
    const health = classifyGscSitemapRow(row);
    if (health === "ok") healthyCount += 1;
    if (health === "warning") warningCount += 1;
    if (health === "error") errorCount += 1;
    if (health === "pending") pendingCount += 1;
    detectedUrlCount += row.contentsCount;
    detectedVideoCount += row.videoSubmitted ?? 0;
  }

  return {
    state: "success_with_data",
    message: `送信済みサイトマップ：${rows.length}件`,
    fetchedAt: input.fetchedAt,
    gscSubmittedCount: rows.length,
    siteGeneratedCount,
    healthyCount,
    warningCount,
    errorCount,
    pendingCount,
    detectedUrlCount,
    detectedVideoCount,
  };
}
