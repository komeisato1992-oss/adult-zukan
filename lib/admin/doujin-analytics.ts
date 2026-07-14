import "server-only";

import { loadGa4CachePersisted } from "@/lib/admin/ga4-cache-store";
import type { Ga4CachePayload, Ga4PageRow } from "@/lib/admin/ga4-types";
import {
  loadDoujinDashboardCache,
  saveDoujinDashboardCache,
} from "@/lib/admin/doujin-dashboard-cache";
import { loadSeoCache } from "@/lib/admin/seo-cache-store";
import type { SeoCachePayload, SeoPageRow } from "@/lib/admin/seo-types";

const DOUJIN_PATH_PREFIX = "/doujin";

function isDoujinPath(pathOrUrl: string): boolean {
  try {
    if (pathOrUrl.startsWith("http")) {
      const pathname = new URL(pathOrUrl).pathname;
      return pathname === DOUJIN_PATH_PREFIX || pathname.startsWith(`${DOUJIN_PATH_PREFIX}/`);
    }
  } catch {
    // fall through
  }
  return (
    pathOrUrl === DOUJIN_PATH_PREFIX ||
    pathOrUrl.startsWith(`${DOUJIN_PATH_PREFIX}/`)
  );
}

function filterGa4Pages(pages: Ga4PageRow[]): Ga4PageRow[] {
  return pages.filter((row) => isDoujinPath(row.path));
}

function filterSeoPages(pages: SeoPageRow[]): SeoPageRow[] {
  return pages.filter((row) => isDoujinPath(row.url));
}

export type DoujinAnalyticsSnapshot = {
  siteType: "doujin";
  pathPrefix: typeof DOUJIN_PATH_PREFIX;
  note: string;
  ga4: {
    updatedAt?: string | null;
    lastSuccessfulAt?: string | null;
    topPages: Ga4PageRow[];
    totalPageViewsFromTop: number;
    connectionStatus?: string;
    fetchError?: string | null;
  };
  seo: {
    updatedAt?: string | null;
    topPages: SeoPageRow[];
    totalClicksFromTop: number;
    totalImpressionsFromTop: number;
    connectionStatus?: string;
    fetchError?: string | null;
  };
};

/**
 * 既存の成人図鑑キャッシュから /doujin 配下だけを抽出する。
 * 成人図鑑キャッシュ自体は変更しない。結果は doujin-dashboard-cache に分離保存する。
 */
export async function getDoujinAnalyticsSnapshot(): Promise<DoujinAnalyticsSnapshot> {
  const [ga4, seo] = await Promise.all([
    loadGa4CachePersisted().catch(() => null as Ga4CachePayload | null),
    loadSeoCache().catch(() => null as SeoCachePayload | null),
  ]);

  const ga4Top = filterGa4Pages(ga4?.topPages ?? []);
  const seoPages =
    filterSeoPages(seo?.periods?.[28]?.pages ?? seo?.pages ?? []);

  const snapshot: DoujinAnalyticsSnapshot = {
    siteType: "doujin",
    pathPrefix: DOUJIN_PATH_PREFIX,
    note:
      "同一プロパティ内の /doujin 配下ページを抽出しています。成人図鑑の数値とは混ぜて表示しません。",
    ga4: {
      updatedAt: ga4?.updatedAt ?? null,
      lastSuccessfulAt: ga4?.lastSuccessfulAt ?? null,
      topPages: ga4Top.slice(0, 30),
      totalPageViewsFromTop: ga4Top.reduce((sum, row) => sum + (row.pageViews ?? 0), 0),
      connectionStatus: ga4?.connectionStatus,
      fetchError: ga4?.fetchError ?? null,
    },
    seo: {
      updatedAt: seo?.updatedAt ?? null,
      topPages: seoPages.slice(0, 30),
      totalClicksFromTop: seoPages.reduce((sum, row) => sum + (row.clicks ?? 0), 0),
      totalImpressionsFromTop: seoPages.reduce(
        (sum, row) => sum + (row.impressions ?? 0),
        0,
      ),
      connectionStatus: seo?.connectionStatus,
      fetchError: seo?.fetchError ?? null,
    },
  };

  const existing = loadDoujinDashboardCache();
  saveDoujinDashboardCache({
    stats: existing?.stats ?? null,
    analytics: snapshot,
  });

  return snapshot;
}
