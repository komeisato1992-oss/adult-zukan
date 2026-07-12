import type { Ga4CachePayload } from "@/lib/admin/ga4-service";
import type { DmmAffiliateCachePayload } from "@/lib/admin/dmm-affiliate-service";
import type { SeoCachePayload } from "@/lib/admin/seo-types";
import type {
  OpsSuggestion,
  OpsSuggestionPriority,
  OpsTask,
} from "@/lib/admin/ops-types";
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
): OpsSuggestion[] {
  const suggestions: OpsSuggestion[] = [];
  const period = seo.periods[28];
  const pages = period?.pages ?? seo.pages ?? [];
  const queries = period?.queries ?? seo.queries ?? [];
  const previousQueries = period?.previousQueries ?? [];

  const midRankPages = pages.filter(
    (page) => page.position >= 8 && page.position <= 15 && page.impressions >= 30,
  );
  if (midRankPages.length > 0) {
    pushSuggestion(
      suggestions,
      "mid-rank-pages",
      `平均順位8〜15位のページが${midRankPages.length}件あります。タイトル改善を推奨。`,
      5,
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
      5,
    );
  }

  const notIndexed = seo.index.notIndexedPages;
  if (notIndexed != null && notIndexed > 0) {
    pushSuggestion(
      suggestions,
      "not-indexed",
      `Google未登録ページが${notIndexed.toLocaleString("ja-JP")}件あります。内部リンク追加を推奨。`,
      5,
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
      4,
    );
  }

  if ((period?.pages?.length ?? 0) >= 5) {
    pushSuggestion(
      suggestions,
      "related-links",
      "人気ページに関連記事リンクを追加してください。",
      3,
    );
  }

  const indexRate = seo.index.registrationRate;
  if (indexRate != null && indexRate < 0.7) {
    pushSuggestion(
      suggestions,
      "index-rate",
      `インデックス率が${(indexRate * 100).toFixed(1)}%です。サイトマップ再送信と内部リンク強化を推奨。`,
      4,
    );
  }

  if (seo.connectionStatus === "error" || seo.fetchError) {
    pushSuggestion(
      suggestions,
      "gsc-error",
      "Search Console APIの取得に失敗しています。認証・権限設定を確認してください。",
      5,
    );
  }

  if (ga4.connectionStatus === "error" || ga4.fetchError) {
    pushSuggestion(
      suggestions,
      "ga4-error",
      "GA4 Data APIの取得に失敗しています。プロパティIDとサービスアカウント権限を確認してください。",
      4,
    );
  }

  if (
    ga4.configured &&
    ga4.connectionStatus === "connected" &&
    (ga4.periods[28]?.current.bounceRate ?? 0) > 0.8
  ) {
    pushSuggestion(
      suggestions,
      "high-bounce",
      "直帰率が高めです。人気ページの導線・関連リンクを見直してください。",
      3,
    );
  }

  if (dmm && !dmm.configured) {
    pushSuggestion(
      suggestions,
      "dmm-unconfigured",
      "DMMアフィリエイト成果が未取込です。/admin/dmm からJSONまたはCSVをアップロードしてください。",
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
