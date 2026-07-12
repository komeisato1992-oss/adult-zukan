import type { Ga4CachePayload } from "@/lib/admin/ga4-service";
import type { SeoCachePayload } from "@/lib/admin/seo-types";
import type { OpsSeoScore, OpsSeoScoreBreakdown } from "@/lib/admin/ops-types";
import { countSubmittedSitemaps } from "@/lib/admin/seo-sitemap-status-utils";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function scoreSearchConsole(seo: SeoCachePayload): number {
  if (!seo.configured || seo.connectionStatus === "unconfigured") return 20;
  if (seo.connectionStatus === "error") return 35;

  const metrics = seo.periods[28]?.current;
  if (!metrics) return 50;

  let score = 55;
  if (metrics.clicks > 0) score += 10;
  if (metrics.impressions > 100) score += 10;
  if (metrics.ctr >= 0.02) score += 10;
  else if (metrics.ctr >= 0.01) score += 5;
  if (metrics.position > 0 && metrics.position <= 20) score += 10;
  else if (metrics.position > 0 && metrics.position <= 40) score += 5;
  return clamp(score);
}

function scoreGa4(ga4: Ga4CachePayload): number {
  if (!ga4.configured || ga4.connectionStatus === "unconfigured") return 20;
  if (ga4.connectionStatus === "error") return 35;

  const metrics = ga4.periods[28]?.current;
  if (!metrics) return 50;

  let score = 55;
  if (metrics.users > 0) score += 15;
  if (metrics.pageViews > 100) score += 10;
  if (metrics.bounceRate > 0 && metrics.bounceRate < 0.7) score += 10;
  else if (metrics.bounceRate > 0 && metrics.bounceRate < 0.85) score += 5;
  if (metrics.pagesPerSession >= 1.5) score += 10;
  return clamp(score);
}

function scoreIndexRate(seo: SeoCachePayload): number {
  const rate = seo.index.registrationRate;
  if (rate == null) {
    return seo.index.indexedPages != null ? 55 : 25;
  }
  return clamp(rate * 100);
}

function scoreSitemap(seo: SeoCachePayload): number {
  const snapshot = seo.sitemapStatus;
  const rows = snapshot?.rows ?? [];
  if (rows.length === 0) return 30;
  if (snapshot?.fetchError) return 40;

  const { submitted, total } = countSubmittedSitemaps(
    snapshot ?? { fetchedAt: null, rows: [] },
  );
  const ratio = total > 0 ? submitted / total : 0;
  let score = 40 + ratio * 50;
  const hasFetchError = rows.some((row) => row.status === "fetch_error");
  if (hasFetchError) score -= 15;
  return clamp(score);
}

function scoreInternalLinks(seo: SeoCachePayload): number {
  const counts = seo.entityPageCounts;
  if (!counts) return 40;
  const entityPages =
    counts.actresses +
    counts.makers +
    counts.labels +
    counts.series +
    counts.genres;
  if (entityPages <= 0) return 35;
  if (entityPages >= 500) return 90;
  if (entityPages >= 100) return 75;
  return clamp(45 + entityPages / 5);
}

function scoreStructuredData(seo: SeoCachePayload): number {
  // 作品詳細に JSON-LD を実装済み。公開作品数に応じて加点。
  const works = seo.overview.totalWorks || seo.entityPageCounts?.works || 0;
  if (works <= 0) return 40;
  if (works >= 1000) return 95;
  if (works >= 100) return 85;
  return clamp(60 + works / 10);
}

export function computeOpsSeoScore(
  seo: SeoCachePayload,
  ga4: Ga4CachePayload,
): OpsSeoScore {
  const breakdown: OpsSeoScoreBreakdown = {
    searchConsole: scoreSearchConsole(seo),
    ga4: scoreGa4(ga4),
    indexRate: scoreIndexRate(seo),
    sitemap: scoreSitemap(seo),
    internalLinks: scoreInternalLinks(seo),
    structuredData: scoreStructuredData(seo),
  };

  const weights: Record<keyof OpsSeoScoreBreakdown, number> = {
    searchConsole: 0.25,
    ga4: 0.15,
    indexRate: 0.2,
    sitemap: 0.15,
    internalLinks: 0.15,
    structuredData: 0.1,
  };

  const total = clamp(
    Object.entries(breakdown).reduce((sum, [key, value]) => {
      return sum + value * weights[key as keyof OpsSeoScoreBreakdown];
    }, 0),
  );

  return { total, breakdown };
}
