import type { Ga4CachePayload } from "@/lib/admin/ga4-service";
import type { DmmAffiliateCachePayload } from "@/lib/admin/dmm-affiliate-service";
import type { SeoCachePayload } from "@/lib/admin/seo-types";
import type { OpsAlert } from "@/lib/admin/ops-types";
import { computeChangePercent } from "@/lib/admin/seo-insights";
import type { GscSitemapSummary } from "@/lib/admin/seo-sitemap-gsc-summary";

export function buildOpsAlerts(
  seo: SeoCachePayload,
  ga4: Ga4CachePayload,
  dmm: DmmAffiliateCachePayload,
  sitemapSummary: GscSitemapSummary,
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

  if (sitemapSummary.state === "error") {
    alerts.push({
      id: "sitemap-fetch-fail",
      title: "サイトマップ情報の取得に失敗しました",
      detail:
        sitemapSummary.fetchError ??
        "Search Console APIからサイトマップ一覧を取得できませんでした。",
      severity: "critical",
    });
  } else if (sitemapSummary.state === "success_empty") {
    alerts.push({
      id: "sitemap-empty",
      title: "サイトマップ未送信",
      detail: "Search Consoleに送信済みのサイトマップがありません",
      severity: "critical",
    });
  } else if (sitemapSummary.state === "success_with_data") {
    if (sitemapSummary.errorCount > 0) {
      alerts.push({
        id: "sitemap-errors",
        title: "サイトマップエラー",
        detail: `${sitemapSummary.errorCount}件のサイトマップにエラーがあります。`,
        severity: "critical",
      });
    } else if (sitemapSummary.warningCount > 0) {
      alerts.push({
        id: "sitemap-warnings",
        title: "サイトマップ警告",
        detail: `${sitemapSummary.warningCount}件のサイトマップに警告があります。`,
        severity: "warning",
      });
    } else {
      alerts.push({
        id: "sitemap-ok",
        title: "サイトマップは正常に送信されています",
        detail: `送信済み ${sitemapSummary.gscSubmittedCount}件（正常 ${sitemapSummary.healthyCount}件）`,
        severity: "success",
      });
    }

    const downloadFailed = seo.sitemaps.some(
      (row) => !row.lastDownloaded && row.errors > 0,
    );
    if (downloadFailed) {
      alerts.push({
        id: "sitemap-download-fail",
        title: "サイトマップ最終ダウンロード失敗",
        detail: "一部サイトマップで最終ダウンロードに失敗しています。",
        severity: "critical",
      });
    }
  } else if (sitemapSummary.state === "unavailable") {
    alerts.push({
      id: "sitemap-unavailable",
      title: "サイトマップ未設定",
      detail: sitemapSummary.message,
      severity: "info",
    });
  }

  if (seo.connectionStatus === "error" || Boolean(seo.fetchError)) {
    alerts.push({
      id: "gsc-api-fail",
      title: "API取得失敗",
      detail: seo.fetchError ?? "Search Console APIの取得に失敗しました。",
      severity: "critical",
    });
  }

  if (ga4.connectionStatus === "error" && !ga4.lastSuccessfulAt) {
    alerts.push({
      id: "ga4-api-fail",
      title: "API取得失敗",
      detail: ga4.fetchError ?? "GA4 Data APIの取得に失敗しました。",
      severity: "critical",
    });
  } else if (ga4.connectionStatus === "stale") {
    alerts.push({
      id: "ga4-stale",
      title: "GA4前回データ表示中",
      detail: `前回取得日時: ${ga4.lastSuccessfulAt ?? "不明"}`,
      severity: "warning",
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
    alerts.push({
      id: "404-increase",
      title: "404増加",
      detail: `404関連のクロール問題が ${notFound.count} 件検出されています。`,
      severity: notFound.count >= 10 ? "critical" : "warning",
    });
  }

  return alerts;
}
