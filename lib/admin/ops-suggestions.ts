import type { Ga4CachePayload } from "@/lib/admin/ga4-service";
import type { DmmAffiliateCachePayload } from "@/lib/admin/dmm-affiliate-service";
import type { SeoCachePayload } from "@/lib/admin/seo-types";
import type {
  OpsSuggestion,
  OpsSuggestionPriority,
  OpsTask,
} from "@/lib/admin/ops-types";
import type { OpsSeoScore } from "@/lib/admin/ops-score";
import type { GscSitemapSummary } from "@/lib/admin/seo-sitemap-gsc-summary";
import { buildRisingQueries } from "@/lib/admin/seo-insights";
import { buildDmmInsightSuggestions } from "@/lib/admin/dmm-report-insights";

function starsFor(priority: OpsSuggestionPriority): string {
  if (priority === 5) return "★★★★★";
  if (priority === 4) return "★★★★☆";
  return "★★★☆☆";
}

function pushSuggestion(
  list: OpsSuggestion[],
  id: string,
  text: string,
  priority: OpsSuggestionPriority,
) {
  list.push({ id, text, priority, stars: starsFor(priority) });
}

export function buildOpsSuggestions(
  seo: SeoCachePayload,
  ga4: Ga4CachePayload,
  dmm?: DmmAffiliateCachePayload,
  seoScore?: OpsSeoScore,
  sitemapSummary?: GscSitemapSummary,
): OpsSuggestion[] {
  const suggestions: OpsSuggestion[] = [];
  const period = seo.periods[28];
  const pages = period?.pages ?? seo.pages ?? [];
  const queries = period?.queries ?? seo.queries ?? [];
  const previousQueries = period?.previousQueries ?? [];

  if (seo.connectionStatus === "error" || seo.fetchError) {
    pushSuggestion(
      suggestions,
      "gsc-error",
      "Search Console APIの取得に失敗しています。認証・権限設定を確認してください。",
      5,
    );
  }

  if (sitemapSummary?.state === "error") {
    pushSuggestion(
      suggestions,
      "sitemap-fetch-error",
      "サイトマップ情報の取得に失敗しています。Search Console APIの権限を確認してください。",
      5,
    );
  } else if (sitemapSummary?.state === "success_empty") {
    pushSuggestion(
      suggestions,
      "sitemap-empty",
      "Search Consoleに送信済みサイトマップがありません。/sitemap.xml の送信を確認してください。",
      5,
    );
  } else if (
    sitemapSummary?.state === "success_with_data" &&
    sitemapSummary.errorCount > 0
  ) {
    pushSuggestion(
      suggestions,
      "sitemap-errors",
      `サイトマップにエラーが${sitemapSummary.errorCount}件あります。エラー内容を確認してください。`,
      5,
    );
  }

  const indexCategory = seoScore?.categories.find(
    (category) => category.key === "indexRate",
  );
  if (
    indexCategory?.available &&
    indexCategory.points != null &&
    indexCategory.points <= 10
  ) {
    pushSuggestion(
      suggestions,
      "low-index-rate",
      `${indexCategory.evidence}。人気作品・ランキング・新着ページから作品詳細への内部リンクを増やしてください。`,
      5,
    );
  }

  const midRankPages = pages.filter(
    (page) =>
      page.position >= 8 && page.position <= 20 && page.impressions >= 30,
  );
  if (midRankPages.length > 0) {
    pushSuggestion(
      suggestions,
      "mid-rank-pages",
      `平均順位8〜20位のページが${midRankPages.length}件あります。内部リンクとタイトルの改善を推奨。`,
      4,
    );
  }

  const lowCtrPages = pages.filter(
    (page) => page.ctr < 0.02 && page.impressions >= 80,
  );
  if (lowCtrPages.length > 0) {
    pushSuggestion(
      suggestions,
      "low-ctr-pages",
      `CTRが2%未満のページが${lowCtrPages.length}件あります。タイトル・ディスクリプション改善を推奨。`,
      4,
    );
  }

  const internal = seoScore?.categories.find(
    (category) => category.key === "internalLinks",
  );
  if (internal?.available && internal.points != null && internal.points < 12) {
    pushSuggestion(
      suggestions,
      "internal-links",
      `内部リンク達成率が低めです（${internal.evidence}）。関連作品リンクの追加を推奨。`,
      4,
    );
  }

  const structured = seoScore?.categories.find(
    (category) => category.key === "structuredData",
  );
  if (
    structured?.available &&
    structured.points != null &&
    structured.points < 9
  ) {
    pushSuggestion(
      suggestions,
      "structured-data",
      `構造化データに改善余地があります（${structured.evidence}）。`,
      3,
    );
  }

  if (
    ga4.configured &&
    ga4.connectionStatus === "connected" &&
    ((ga4.periods[28]?.current.avgEngagementSeconds ?? 0) < 30 ||
      (ga4.periods[28]?.current.pagesPerSession ?? 0) < 1.5)
  ) {
    pushSuggestion(
      suggestions,
      "ga4-engagement",
      "GA4の回遊・エンゲージメントが低めです。関連リンクと導線を見直してください。",
      3,
    );
  }

  const rising = buildRisingQueries(queries, previousQueries, 5);
  const surge = rising.filter(
    (row) => row.isNew || (row.changePercent != null && row.changePercent >= 50),
  );
  if (surge.length > 0) {
    pushSuggestion(
      suggestions,
      "rising-queries",
      `表示回数が急増している検索キーワードが${surge.length}件あります。関連記事作成を推奨。`,
      3,
    );
  }

  if (dmm && (dmm.rowCount <= 0 || dmm.connectionStatus === "unconfigured")) {
    pushSuggestion(
      suggestions,
      "dmm-unconfigured",
      "DMMアフィリエイト成果が未取込です。カテゴリCSV / ダイレクトCSVをアップロードしてください。",
      3,
    );
  }

  if (dmm?.insights) {
    for (const item of buildDmmInsightSuggestions(dmm.insights)) {
      pushSuggestion(suggestions, item.id, item.text, item.priority);
    }
  }

  if (suggestions.length === 0) {
    pushSuggestion(
      suggestions,
      "stable",
      "大きな異常は検出されていません。人気クエリのCTR改善を継続してください。",
      3,
    );
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}

export function buildOpsTasks(
  seo: SeoCachePayload,
  suggestions: OpsSuggestion[],
): OpsTask[] {
  const tasks: OpsTask[] = [];
  const top = suggestions.slice(0, 3);

  for (const suggestion of top) {
    tasks.push({
      id: `task-${suggestion.id}`,
      text: suggestion.text,
      bucket:
        suggestion.priority === 5
          ? "urgent"
          : suggestion.priority === 4
            ? "this_week"
            : "backlog",
      completed: false,
    });
  }

  const lowCtr = (seo.periods[28]?.pages ?? []).filter(
    (page) => page.ctr < 0.02 && page.impressions >= 80,
  ).length;
  if (lowCtr > 0) {
    tasks.push({
      id: "task-rewrite-titles",
      text: `CTR低ページのタイトルを${Math.min(lowCtr, 10)}件改善する`,
      bucket: "this_week",
      completed: false,
    });
  }

  if ((seo.index.notIndexedPages ?? 0) > 0) {
    tasks.push({
      id: "task-internal-links",
      text: "未登録ページへ内部リンクを追加する",
      bucket: "urgent",
      completed: false,
    });
  }

  tasks.push({
    id: "task-sitemap-check",
    text: "サイトマップ送信状況を確認する",
    bucket: "backlog",
    completed: false,
  });

  const seen = new Set<string>();
  return tasks.filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}
