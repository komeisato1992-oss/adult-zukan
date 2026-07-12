import type { Ga4CachePayload } from "@/lib/admin/ga4-types";
import type { DmmAffiliateCachePayload } from "@/lib/admin/dmm-report-types";
import type { SeoCachePayload } from "@/lib/admin/seo-types";

export type OpsAnalyticsKpis = {
  salesToday: number | null;
  salesYesterday: number | null;
  sales28d: number | null;
  googleSessions28d: number | null;
  searchClicks28d: number | null;
  avgPosition28d: number | null;
  ctr28d: number | null;
  conversionRate28d: number | null;
  rpm28d: number | null;
  cvr28d: number | null;
  lastSuccessfulAt: {
    ga4: string | null;
    dmm: string | null;
    seo: string | null;
  };
};

function organicSessions(ga4: Ga4CachePayload): number | null {
  if (!ga4.lastSuccessfulAt && ga4.connectionStatus !== "connected") {
    return null;
  }
  const organic = ga4.sources.find((row) => {
    const name = row.source.toLowerCase();
    return name.includes("organic") || name.includes("google");
  });
  if (organic) return organic.sessions;
  // チャネルが無い場合でも users があれば Google流入の代替にしない（null）
  return ga4.sources.length > 0 ? 0 : null;
}

export function buildOpsAnalyticsKpis(
  seo: SeoCachePayload,
  ga4: Ga4CachePayload,
  dmm: DmmAffiliateCachePayload,
): OpsAnalyticsKpis {
  const seoReady =
    seo.connectionStatus === "connected" ||
    Boolean(seo.updatedAt && !seo.fetchError);
  const ga4Ready =
    ga4.connectionStatus === "connected" ||
    ga4.connectionStatus === "stale" ||
    Boolean(ga4.lastSuccessfulAt);
  const dmmReady =
    dmm.connectionStatus === "connected" ||
    dmm.connectionStatus === "stale" ||
    Boolean(dmm.lastSuccessfulAt) ||
    dmm.rowCount > 0;

  const clicks28 = seoReady ? seo.periods[28]?.current.clicks ?? null : null;
  const ctr28 = seoReady ? seo.periods[28]?.current.ctr ?? null : null;
  const position28 = seoReady
    ? seo.periods[28]?.current.position || null
    : null;

  const salesToday = dmmReady ? dmm.periods.today.reward : null;
  const salesYesterday = dmmReady ? dmm.periods.yesterday.reward : null;
  const sales28d = dmmReady ? dmm.periods["28d"].reward : null;
  const cvr = dmmReady ? dmm.periods["28d"].conversionRate : null;

  const pageViews28 = ga4Ready ? ga4.periods[28]?.current.pageViews ?? null : null;
  const rpm =
    sales28d != null && pageViews28 != null && pageViews28 > 0
      ? (sales28d / pageViews28) * 1000
      : sales28d != null && clicks28 != null && clicks28 > 0
        ? (sales28d / clicks28) * 1000
        : null;

  return {
    salesToday,
    salesYesterday,
    sales28d,
    googleSessions28d: ga4Ready ? organicSessions(ga4) : null,
    searchClicks28d: clicks28,
    avgPosition28d: position28,
    ctr28d: ctr28,
    conversionRate28d: cvr,
    rpm28d: rpm,
    cvr28d: cvr,
    lastSuccessfulAt: {
      ga4: ga4.lastSuccessfulAt,
      dmm: dmm.lastSuccessfulAt,
      seo: seo.updatedAt,
    },
  };
}
