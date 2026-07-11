import { slugify } from "@/lib/utils";
import type {
  SeoCachePayload,
  SeoChanceTabId,
  SeoEntityRankingRow,
  SeoNewWorkRow,
  SeoOpportunityRow,
  SeoPageRow,
  SeoPeriodDays,
  SeoPeriodBundle,
  SeoQueryRow,
  SeoRisingQueryRow,
  SeoWeeklySuggestion,
} from "@/lib/admin/seo-types";

export function getPeriodBundle(
  data: SeoCachePayload,
  period: SeoPeriodDays,
): SeoPeriodBundle {
  return data.periods[period];
}

export function computeChangePercent(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    return current > 0 ? null : 0;
  }
  return ((current - previous) / previous) * 100;
}

export function computePositionDelta(
  current: number,
  previous: number,
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (current <= 0 || previous <= 0) return null;
  return previous - current;
}

export function extractPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function extractEntitySlug(url: string, prefix: string): string | null {
  const pathname = extractPathname(url);
  if (!pathname.startsWith(prefix)) return null;
  const slug = pathname.slice(prefix.length).split("/")[0];
  return slug ? decodeURIComponent(slug) : null;
}

function aggregateEntityPages(
  pages: SeoPageRow[],
  prefix: string,
): Map<
  string,
  {
    name: string;
    url: string;
    clicks: number;
    impressions: number;
    weightedPosition: number;
  }
> {
  const map = new Map<
    string,
    {
      name: string;
      url: string;
      clicks: number;
      impressions: number;
      weightedPosition: number;
    }
  >();

  for (const page of pages) {
    const slug = extractEntitySlug(page.url, prefix);
    if (!slug) continue;

    const existing = map.get(slug);
    if (existing) {
      existing.clicks += page.clicks;
      existing.impressions += page.impressions;
      existing.weightedPosition += page.position * page.impressions;
      if (page.clicks > existing.clicks) {
        existing.name = page.title;
        existing.url = page.url;
      }
    } else {
      map.set(slug, {
        name: page.title,
        url: page.url,
        clicks: page.clicks,
        impressions: page.impressions,
        weightedPosition: page.position * page.impressions,
      });
    }
  }

  return map;
}

export function buildEntityRankings(
  pages: SeoPageRow[],
  previousPages: SeoPageRow[],
  prefix: string,
  workCounts: Record<string, number>,
  limit = 15,
): SeoEntityRankingRow[] {
  const current = aggregateEntityPages(pages, prefix);
  const previous = aggregateEntityPages(previousPages, prefix);

  return [...current.entries()]
    .map(([slug, row]) => {
      const prev = previous.get(slug);
      const ctr = row.impressions > 0 ? row.clicks / row.impressions : 0;
      const position =
        row.impressions > 0 ? row.weightedPosition / row.impressions : 0;
      return {
        slug,
        name: row.name || slug,
        url: row.url,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr,
        position,
        changePercent: prev
          ? computeChangePercent(row.clicks, prev.clicks)
          : null,
        workCount: workCounts[slugify(slug)] ?? workCounts[slug] ?? null,
      };
    })
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, limit);
}

export function buildRisingQueries(
  current: SeoQueryRow[],
  previous: SeoQueryRow[],
  limit = 20,
): SeoRisingQueryRow[] {
  const previousMap = new Map(
    previous.map((row) => [row.keyword, row.clicks]),
  );

  return current
    .map((row) => {
      const prevClicks = previousMap.get(row.keyword) ?? 0;
      const isNew = prevClicks === 0 && row.clicks > 0;
      return {
        rank: 0,
        keyword: row.keyword,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        changePercent: isNew
          ? null
          : computeChangePercent(row.clicks, prevClicks),
        isNew,
      };
    })
    .filter((row) => row.clicks > 0 && (row.isNew || (row.changePercent ?? 0) > 0))
    .sort((a, b) => {
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      const aChange = a.changePercent ?? 999;
      const bChange = b.changePercent ?? 999;
      return bChange - aChange || b.clicks - a.clicks;
    })
    .slice(0, limit)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function mapQueryOpportunity(
  row: SeoQueryRow,
  reason: string,
  id: string,
): SeoOpportunityRow {
  return {
    id,
    kind: "query",
    label: row.keyword,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
    reason,
  };
}

function mapPageOpportunity(
  row: SeoPageRow,
  reason: string,
  id: string,
  changePercent?: number | null,
): SeoOpportunityRow {
  return {
    id,
    kind: "page",
    label: row.title,
    url: row.url,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
    reason,
    changePercent,
  };
}

export function buildSeoOpportunities(
  queries: SeoQueryRow[],
  previousQueries: SeoQueryRow[],
  pages: SeoPageRow[],
  previousPages: SeoPageRow[],
): Record<
  SeoChanceTabId,
  SeoOpportunityRow[]
> {
  const ctrImprovement = [
    ...queries
      .filter(
        (row) =>
          row.impressions >= 100 && row.position <= 10 && row.ctr < 0.02,
      )
      .slice(0, 15)
      .map((row, index) =>
        mapQueryOpportunity(
          row,
          "表示回数が多いのにCTRが低い — タイトル・description改善候補",
          `ctr-query-${index}`,
        ),
      ),
    ...pages
      .filter(
        (row) =>
          row.impressions >= 100 && row.position <= 10 && row.ctr < 0.02,
      )
      .slice(0, 15)
      .map((row, index) =>
        mapPageOpportunity(
          row,
          "表示回数が多いのにCTRが低い — タイトル・description改善候補",
          `ctr-page-${index}`,
        ),
      ),
  ].slice(0, 20);

  const page2 = [
    ...queries
      .filter(
        (row) =>
          row.position > 10 && row.position <= 20 && row.impressions >= 50,
      )
      .slice(0, 10)
      .map((row, index) =>
        mapQueryOpportunity(
          row,
          "あと少しで1ページ目に入る可能性があります",
          `page2-query-${index}`,
        ),
      ),
    ...pages
      .filter(
        (row) =>
          row.position > 10 && row.position <= 20 && row.impressions >= 50,
      )
      .slice(0, 10)
      .map((row, index) =>
        mapPageOpportunity(
          row,
          "あと少しで1ページ目に入る可能性があります",
          `page2-page-${index}`,
        ),
      ),
  ].slice(0, 20);

  const previousQueryMap = new Map(
    previousQueries.map((row) => [row.keyword, row]),
  );
  const previousPageMap = new Map(previousPages.map((row) => [row.url, row]));

  const rising = [
    ...queries
      .filter((row) => {
        const prev = previousQueryMap.get(row.keyword);
        return (
          prev &&
          (row.clicks > prev.clicks || row.impressions > prev.impressions)
        );
      })
      .slice(0, 10)
      .map((row, index) => {
        const prev = previousQueryMap.get(row.keyword)!;
        return mapQueryOpportunity(
          row,
          `クリック ${prev.clicks} → ${row.clicks} / 表示 ${prev.impressions} → ${row.impressions}`,
          `rising-query-${index}`,
        );
      }),
    ...pages
      .filter((row) => {
        const prev = previousPageMap.get(row.url);
        return (
          prev &&
          (row.clicks > prev.clicks || row.impressions > prev.impressions)
        );
      })
      .slice(0, 10)
      .map((row, index) => {
        const prev = previousPageMap.get(row.url)!;
        const change = computeChangePercent(row.clicks, prev.clicks);
        return mapPageOpportunity(
          row,
          `クリック ${prev.clicks} → ${row.clicks} / 表示 ${prev.impressions} → ${row.impressions}`,
          `rising-page-${index}`,
          change,
        );
      }),
  ]
    .sort(
      (a, b) =>
        (b.changePercent ?? 0) - (a.changePercent ?? 0) ||
        b.clicks - a.clicks,
    )
    .slice(0, 20);

  const declining = [
    ...queries
      .filter((row) => {
        const prev = previousQueryMap.get(row.keyword);
        return prev && prev.clicks > 0 && row.clicks < prev.clicks * 0.7;
      })
      .slice(0, 10)
      .map((row, index) => {
        const prev = previousQueryMap.get(row.keyword)!;
        const change = computeChangePercent(row.clicks, prev.clicks);
        return {
          ...mapQueryOpportunity(
            row,
            `クリック ${prev.clicks} → ${row.clicks}（大幅減少）`,
            `declining-query-${index}`,
          ),
          changePercent: change,
        };
      }),
    ...pages
      .filter((row) => {
        const prev = previousPageMap.get(row.url);
        return prev && prev.clicks > 0 && row.clicks < prev.clicks * 0.7;
      })
      .slice(0, 10)
      .map((row, index) => {
        const prev = previousPageMap.get(row.url)!;
        const change = computeChangePercent(row.clicks, prev.clicks);
        return mapPageOpportunity(
          row,
          `クリック ${prev.clicks} → ${row.clicks}（大幅減少）`,
          `declining-page-${index}`,
          change,
        );
      }),
  ]
    .sort(
      (a, b) =>
        (a.changePercent ?? 0) - (b.changePercent ?? 0) || a.clicks - b.clicks,
    )
    .slice(0, 20);

  return {
    ctr: ctrImprovement,
    page2,
    rising,
    declining,
  };
}

export function buildWeeklySuggestions(
  opportunities: ReturnType<typeof buildSeoOpportunities>,
  risingQueries: SeoRisingQueryRow[],
  actressRankings: SeoEntityRankingRow[],
  periodMetrics: { impressions: number; previousImpressions: number },
  period: SeoPeriodDays,
): SeoWeeklySuggestion[] {
  const suggestions: SeoWeeklySuggestion[] = [];

  const ctrCount = opportunities.ctr.length;
  if (ctrCount > 0) {
    suggestions.push({
      id: "ctr-low",
      text: `表示回数が多くCTRが低いページ・クエリが${ctrCount}件あります`,
      targetTab: "overview",
      targetChanceTab: "ctr",
    });
  }

  const page2Count = opportunities.page2.length;
  if (page2Count > 0) {
    suggestions.push({
      id: "page2",
      text: `11〜20位のページ・クエリが${page2Count}件あります`,
      targetTab: "overview",
      targetChanceTab: "page2",
    });
  }

  const impressionChange = computeChangePercent(
    periodMetrics.impressions,
    periodMetrics.previousImpressions,
  );
  const topRising = risingQueries[0];
  if (topRising && topRising.isNew) {
    suggestions.push({
      id: "rising-query",
      text: `「${topRising.keyword}」が新規流入クエリとして伸びています`,
      targetTab: "overview",
    });
  } else if (
    topRising &&
    topRising.changePercent !== null &&
    topRising.changePercent >= 30
  ) {
    suggestions.push({
      id: "rising-query",
      text: `「${topRising.keyword}」関連のクリック数が前期間比${Math.round(topRising.changePercent)}%増加しています`,
      targetTab: "overview",
    });
  } else if (impressionChange !== null && impressionChange >= 20) {
    suggestions.push({
      id: "impressions-up",
      text: `表示回数が前期間比${Math.round(impressionChange)}%増加しています（${period}日）`,
      targetTab: "overview",
    });
  }

  const topActress = actressRankings[0];
  if (topActress && topActress.workCount !== null && topActress.workCount < 20) {
    suggestions.push({
      id: "actress-expand",
      text: `検索流入の多い女優「${topActress.name}」の掲載作品を増やす余地があります`,
      targetTab: "overview",
    });
  }

  return suggestions.slice(0, 5);
}

export function enrichPagesWithComparison(
  pages: SeoPageRow[],
  previousPages: SeoPageRow[],
): Array<SeoPageRow & { changePercent: number | null; isNew: boolean }> {
  const previousMap = new Map(previousPages.map((row) => [row.url, row.clicks]));
  return pages.map((row) => {
    const prevClicks = previousMap.get(row.url) ?? 0;
    const isNew = prevClicks === 0 && row.clicks > 0;
    return {
      ...row,
      isNew,
      changePercent: isNew
        ? null
        : computeChangePercent(row.clicks, prevClicks),
    };
  });
}

export function sliceDailyStatsForPeriod(
  dailyStats: SeoCachePayload["dailyStats"],
  period: SeoPeriodDays,
): SeoCachePayload["dailyStats"] {
  return dailyStats.slice(-period);
}

export function hasGscData(data: SeoCachePayload): boolean {
  return (
    data.configured &&
    data.connectionStatus === "connected" &&
    Boolean(data.updatedAt)
  );
}

export function formatMetricValue(
  value: number | null | undefined,
  options?: { fetched?: boolean; error?: boolean },
): string {
  if (options?.error) return "取得失敗";
  if (!options?.fetched) return "—";
  if (value === null || value === undefined) return "—";
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("ja-JP");
}

export function summarizeNewWorks(rows: SeoNewWorkRow[]): {
  withSearchData: number;
  withoutSearchData: number;
} {
  let withSearchData = 0;
  let withoutSearchData = 0;
  for (const row of rows) {
    if (row.status === "has_search_data") withSearchData += 1;
    else withoutSearchData += 1;
  }
  return { withSearchData, withoutSearchData };
}
