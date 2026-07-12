import type { Ga4CachePayload } from "@/lib/admin/ga4-service";
import type { DmmAffiliateCachePayload } from "@/lib/admin/dmm-affiliate-service";
import type { SeoCachePayload } from "@/lib/admin/seo-types";
import type { OpsAlert } from "@/lib/admin/ops-types";
import { computeChangePercent } from "@/lib/admin/seo-insights";
import { countSubmittedSitemaps } from "@/lib/admin/seo-sitemap-status-utils";

export function buildOpsAlerts(
  seo: SeoCachePayload,
  ga4: Ga4CachePayload,
  dmm: DmmAffiliateCachePayload,
): OpsAlert[] {
  const alerts: OpsAlert[] = [];
  const current = seo.periods[28]?.current;
  const previous = seo.periods[28]?.previous;

  if (current && previous && previous.position > 0 && current.position > 0) {
    const positionWorsened = current.position - previous.position;
    if (positionWorsened >= 3) {
      alerts.push({
        id: "rank-drop",
        title: "順位急落",
        detail: `平均掲載順位が ${previous.position.toFixed(1)} → ${current.position.toFixed(1)} に悪化しています。`,
        severity: "critical",
      });
    }
  }

  if (current && previous && previous.ctr > 0) {
    const ctrChange = computeChangePercent(current.ctr, previous.ctr);
    if (ctrChange != null && ctrChange <= -20) {
      alerts.push({
        id: "ctr-drop",
        title: "CTR急落",
        detail: `CTRが前期間比 ${ctrChange.toFixed(1)}% 低下しています。`,
        severity: "critical",
      });
    }
  }

  const history = seo.index.history ?? [];
  if (history.length >= 2) {
    const latest = history[history.length - 1];
    const prev = history[history.length - 2];
    if (
      latest.indexedPages < prev.indexedPages &&
      prev.indexedPages - latest.indexedPages >= 10
    ) {
      alerts.push({
        id: "index-drop",
        title: "Google登録ページ減少",
        detail: `登録ページ数が ${prev.indexedPages.toLocaleString("ja-JP")} → ${latest.indexedPages.toLocaleString("ja-JP")} に減少しました。`,
        severity: "critical",
      });
    }
  }

  const sitemapRows = seo.sitemapStatus?.rows ?? [];
  const fetchErrors = sitemapRows.filter((row) => row.status === "fetch_error");
  if (seo.sitemapStatus?.fetchError || fetchErrors.length > 0) {
    alerts.push({
      id: "sitemap-fail",
      title: "サイトマップ送信失敗",
      detail:
        seo.sitemapStatus?.fetchError ??
        `${fetchErrors.length}件のサイトマップで取得/送信エラーがあります。`,
      severity: "critical",
    });
  } else if (seo.sitemapStatus && sitemapRows.length > 0) {
    const { submitted } = countSubmittedSitemaps(seo.sitemapStatus);
    if (submitted === 0) {
      alerts.push({
        id: "sitemap-unsubmitted",
        title: "サイトマップ送信失敗",
        detail: "送信済みサイトマップがありません。",
        severity: "warning",
      });
    }
  }

  if (seo.connectionStatus === "error" || Boolean(seo.fetchError)) {
    alerts.push({
      id: "gsc-api-fail",
      title: "API取得失敗",
      detail: seo.fetchError ?? "Search Console APIの取得に失敗しました。",
      severity: "critical",
    });
  }

  if (ga4.connectionStatus === "error" || Boolean(ga4.fetchError)) {
    alerts.push({
      id: "ga4-api-fail",
      title: "API取得失敗",
      detail: ga4.fetchError ?? "GA4 Data APIの取得に失敗しました。",
      severity: "critical",
    });
  }

  if (dmm.connectionStatus === "error" || Boolean(dmm.fetchError)) {
    alerts.push({
      id: "dmm-api-fail",
      title: "API取得失敗",
      detail: dmm.fetchError ?? "DMMアフィリエイト成果の取得に失敗しました。",
      severity: "warning",
    });
  }

  const notFound = seo.crawlErrors?.find((group) => group.type === "404");
  if (notFound && notFound.count > 0) {
    const prev404 =
      seo.crawlErrors?.find((group) => group.type === "404")?.count ?? 0;
    alerts.push({
      id: "404-increase",
      title: "404増加",
      detail: `404関連のクロール問題が ${notFound.count} 件検出されています。`,
      severity: notFound.count >= 10 || prev404 > 0 ? "critical" : "warning",
    });
  }

  return alerts;
}
