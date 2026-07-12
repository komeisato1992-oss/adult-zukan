import type { OpsDashboardPayload, OpsGscPeriod } from "@/lib/admin/ops-types";
import type { SeoPeriodMetrics } from "@/lib/admin/seo-types";

export type OpsDataStatusKind =
  | "ok"
  | "refreshing"
  | "unconfigured"
  | "not_fetched"
  | "error"
  | "stale";

export type OpsDataStatus = {
  kind: OpsDataStatusKind;
  label: string;
  detail: string | null;
};

function emptyMetrics(): SeoPeriodMetrics {
  return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
}

export function metricsFromDaily(
  daily: OpsDashboardPayload["seo"]["dailyStats"],
  days: number,
  offsetDays = 0,
): SeoPeriodMetrics {
  const slice = daily.slice(-(days + offsetDays), offsetDays === 0 ? undefined : -offsetDays);
  if (slice.length === 0) return emptyMetrics();
  const clicks = slice.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = slice.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition = slice.reduce(
    (sum, row) => sum + row.position * row.impressions,
    0,
  );
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
  };
}

export function resolveGscMetrics(
  seo: OpsDashboardPayload["seo"],
  period: OpsGscPeriod,
): { current: SeoPeriodMetrics; previous: SeoPeriodMetrics } {
  if (period === "1") {
    return {
      current: metricsFromDaily(seo.dailyStats, 1),
      previous: metricsFromDaily(seo.dailyStats, 1, 1),
    };
  }
  const bundle = seo.periods[Number(period) as 7 | 28 | 90];
  return {
    current: bundle?.current ?? emptyMetrics(),
    previous: bundle?.previous ?? emptyMetrics(),
  };
}

export function mapTrafficSources(ga4: OpsDashboardPayload["ga4"]) {
  const groups: Record<string, number> = {
    Google検索: 0,
    X: 0,
    直接流入: 0,
    参照サイト: 0,
    その他: 0,
  };

  for (const row of ga4.sources) {
    const name = row.source.toLowerCase();
    if (name.includes("organic") || name.includes("google")) {
      groups["Google検索"] += row.sessions;
    } else if (
      name.includes("social") ||
      name.includes("twitter") ||
      name.includes("x")
    ) {
      groups.X += row.sessions;
    } else if (name.includes("direct")) {
      groups["直接流入"] += row.sessions;
    } else if (name.includes("referral")) {
      groups["参照サイト"] += row.sessions;
    } else {
      groups["その他"] += row.sessions;
    }
  }

  return groups;
}

function formatStaleDetail(
  fetchError: string | undefined,
  lastSuccessfulAt: string | null,
  formatDateTime: (value: string | null) => string,
): string {
  if (fetchError && lastSuccessfulAt) {
    return `最新取得に失敗しました。${formatDateTime(lastSuccessfulAt)}取得のデータを表示しています。${fetchError ? `（${fetchError}）` : ""}`;
  }
  if (fetchError) {
    return `取得に失敗しました: ${fetchError}`;
  }
  if (lastSuccessfulAt) {
    return `${formatDateTime(lastSuccessfulAt)}取得のデータを表示しています。`;
  }
  return "最新取得に失敗しました。";
}

export function deriveSeoDataStatus(
  seo: OpsDashboardPayload["seo"],
  refreshing: boolean,
  formatDateTime: (value: string | null) => string,
): OpsDataStatus {
  if (refreshing) {
    return { kind: "refreshing", label: "更新中", detail: null };
  }
  if (!seo.configured) {
    return {
      kind: "unconfigured",
      label: "未設定",
      detail: seo.configMessage ?? "Search Console APIが未設定です。",
    };
  }
  if (seo.fetchError || seo.connectionStatus === "error") {
    if (seo.updatedAt || seo.stale) {
      return {
        kind: "stale",
        label: "前回データ表示中",
        detail: formatStaleDetail(
          seo.fetchError,
          seo.updatedAt,
          formatDateTime,
        ),
      };
    }
    return {
      kind: "error",
      label: "取得失敗",
      detail: seo.fetchError ?? "Search Consoleの取得に失敗しました。",
    };
  }
  if (!seo.updatedAt) {
    return {
      kind: "not_fetched",
      label: "未取得",
      detail: "Search Consoleデータをまだ取得していません。",
    };
  }
  if (seo.stale) {
    return {
      kind: "stale",
      label: "前回データ表示中",
      detail: formatStaleDetail(seo.fetchError, seo.updatedAt, formatDateTime),
    };
  }
  return { kind: "ok", label: "正常", detail: null };
}

export function deriveGa4DataStatus(
  ga4: OpsDashboardPayload["ga4"],
  refreshing: boolean,
  formatDateTime: (value: string | null) => string,
): OpsDataStatus {
  if (refreshing) {
    return { kind: "refreshing", label: "更新中", detail: null };
  }
  if (!ga4.configured || ga4.connectionStatus === "unconfigured") {
    return {
      kind: "unconfigured",
      label: "未設定",
      detail: ga4.configMessage ?? "GA4 APIが未設定です。",
    };
  }
  if (ga4.fetchError || ga4.connectionStatus === "error") {
    if (ga4.lastSuccessfulAt || ga4.updatedAt) {
      return {
        kind: "stale",
        label: "前回データ表示中",
        detail: formatStaleDetail(
          ga4.fetchError,
          ga4.lastSuccessfulAt ?? ga4.updatedAt,
          formatDateTime,
        ),
      };
    }
    return {
      kind: "error",
      label: "取得失敗",
      detail: ga4.fetchError ?? "GA4の取得に失敗しました。",
    };
  }
  if (ga4.connectionStatus === "stale") {
    return {
      kind: "stale",
      label: "前回データ表示中",
      detail: formatStaleDetail(
        ga4.fetchError,
        ga4.lastSuccessfulAt ?? ga4.updatedAt,
        formatDateTime,
      ),
    };
  }
  if (!ga4.lastSuccessfulAt && !ga4.updatedAt) {
    return {
      kind: "not_fetched",
      label: "未取得",
      detail: "GA4データをまだ取得していません。",
    };
  }
  return { kind: "ok", label: "正常", detail: null };
}

export function deriveDmmDataStatus(
  dmm: OpsDashboardPayload["dmm"],
  refreshing: boolean,
  formatDateTime: (value: string | null) => string,
): OpsDataStatus {
  if (refreshing) {
    return { kind: "refreshing", label: "更新中", detail: null };
  }
  if (!dmm.configured || dmm.connectionStatus === "unconfigured") {
    return {
      kind: "unconfigured",
      label: "未設定",
      detail: dmm.configMessage ?? "DMM成果の自動取得が未設定です。",
    };
  }
  if (dmm.fetchError || dmm.connectionStatus === "error") {
    if (dmm.lastSuccessfulAt || dmm.rowCount > 0) {
      return {
        kind: "stale",
        label: "前回データ表示中",
        detail: formatStaleDetail(
          dmm.fetchError,
          dmm.lastSuccessfulAt ?? dmm.updatedAt,
          formatDateTime,
        ),
      };
    }
    return {
      kind: "error",
      label: "取得失敗",
      detail: dmm.fetchError ?? "DMM成果の取得に失敗しました。",
    };
  }
  if (dmm.connectionStatus === "stale") {
    return {
      kind: "stale",
      label: "前回データ表示中",
      detail: formatStaleDetail(
        dmm.fetchError,
        dmm.lastSuccessfulAt ?? dmm.updatedAt,
        formatDateTime,
      ),
    };
  }
  if (dmm.rowCount <= 0 || (!dmm.lastSuccessfulAt && !dmm.updatedAt)) {
    return {
      kind: "not_fetched",
      label: "未取得",
      detail: "DMM成果データ未取得",
    };
  }
  return { kind: "ok", label: "正常", detail: null };
}

export function alertClass(
  severity: OpsDashboardPayload["alerts"][number]["severity"],
): string {
  switch (severity) {
    case "critical":
      return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
    case "warning":
      return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100";
    case "success":
      return "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100";
    default:
      return "border-border bg-white text-foreground dark:border-zinc-700 dark:bg-zinc-900";
  }
}
