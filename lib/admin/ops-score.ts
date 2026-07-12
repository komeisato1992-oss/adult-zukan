import type { Ga4CachePayload } from "@/lib/admin/ga4-service";
import type { SeoCachePayload } from "@/lib/admin/seo-types";
import type { InternalLinkAuditResult } from "@/lib/admin/seo-audit-internal-links";
import type { StructuredDataAuditResult } from "@/lib/admin/seo-audit-structured-data";
import {
  buildGscSitemapSummary,
  type GscSitemapSummary,
} from "@/lib/admin/seo-sitemap-gsc-summary";
import { computeChangePercent } from "@/lib/admin/seo-insights";
import { getSitemapEntries } from "@/lib/sitemap/build-entries";

export type ScoreAvailability = "scored" | "unavailable";

export type ScoreDetailLine = {
  label: string;
  points: number | null;
  maxPoints: number;
  evidence: string;
  available: boolean;
};

export type CategoryScore = {
  key:
    | "searchConsole"
    | "ga4"
    | "indexRate"
    | "sitemap"
    | "internalLinks"
    | "structuredData";
  label: string;
  points: number | null;
  maxPoints: number;
  available: boolean;
  statusLabel: string;
  evidence: string;
  improvement: string;
  details: ScoreDetailLine[];
  calculatedAt: string;
};

export type OpsSeoScore = {
  total: number | null;
  maxPossible: number;
  earned: number;
  availableMax: number;
  partial: boolean;
  calculatedAt: string;
  categories: CategoryScore[];
  /** 互換表示用 */
  breakdown: {
    searchConsole: number | null;
    ga4: number | null;
    indexRate: number | null;
    sitemap: number | null;
    internalLinks: number | null;
    structuredData: number | null;
  };
};

function growthBucket(
  changePercent: number | null,
): "up20" | "up0" | "down20" | "downMore" | "none" {
  if (changePercent == null) return "none";
  if (changePercent >= 20) return "up20";
  if (changePercent >= 0) return "up0";
  if (changePercent > -20) return "down20";
  return "downMore";
}

function scoreSearchConsole(seo: SeoCachePayload, now: string): CategoryScore {
  const maxPoints = 20;
  if (!seo.configured || seo.connectionStatus === "unconfigured") {
    return {
      key: "searchConsole",
      label: "Search Console",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "未取得",
      evidence: "Search Console APIが未設定です",
      improvement: "GOOGLE_SERVICE_ACCOUNT_JSON と GSC_SITE_URL を設定してください",
      details: [],
      calculatedAt: now,
    };
  }

  if (seo.connectionStatus === "error" && !seo.periods[28]?.current) {
    return {
      key: "searchConsole",
      label: "Search Console",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "取得失敗",
      evidence: seo.fetchError ?? "Search Console APIの取得に失敗しました",
      improvement: "認証・権限・GSC_SITE_URL を確認して再取得してください",
      details: [],
      calculatedAt: now,
    };
  }

  const current = seo.periods[28]?.current;
  const previous = seo.periods[28]?.previous;
  if (!current || (current.clicks === 0 && current.impressions === 0 && current.position <= 0)) {
    return {
      key: "searchConsole",
      label: "Search Console",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "未取得",
      evidence: "直近28日の検索パフォーマンスデータがありません",
      improvement: "データ反映を待つか、手動更新で再取得してください",
      details: [],
      calculatedAt: now,
    };
  }

  const details: ScoreDetailLine[] = [];

  let positionPoints: number | null = null;
  if (current.position > 0) {
    if (current.position <= 5) positionPoints = 8;
    else if (current.position <= 10) positionPoints = 7;
    else if (current.position <= 20) positionPoints = 5;
    else if (current.position <= 30) positionPoints = 3;
    else positionPoints = 1;
    details.push({
      label: "平均掲載順位",
      points: positionPoints,
      maxPoints: 8,
      evidence: `平均順位 ${current.position.toFixed(1)}`,
      available: true,
    });
  } else {
    details.push({
      label: "平均掲載順位",
      points: null,
      maxPoints: 8,
      evidence: "データなし",
      available: false,
    });
  }

  let ctrPoints: number | null = null;
  if (current.impressions > 0) {
    const ctr = current.ctr;
    if (ctr >= 0.05) ctrPoints = 6;
    else if (ctr >= 0.03) ctrPoints = 5;
    else if (ctr >= 0.02) ctrPoints = 4;
    else if (ctr >= 0.01) ctrPoints = 2;
    else ctrPoints = 1;
    details.push({
      label: "CTR",
      points: ctrPoints,
      maxPoints: 6,
      evidence: `CTR ${(ctr * 100).toFixed(2)}%`,
      available: true,
    });
  } else {
    details.push({
      label: "CTR",
      points: null,
      maxPoints: 6,
      evidence: "データなし",
      available: false,
    });
  }

  const clickChange =
    previous && previous.clicks > 0
      ? computeChangePercent(current.clicks, previous.clicks)
      : previous && previous.clicks === 0 && current.clicks > 0
        ? 100
        : null;
  let clickPoints: number | null = null;
  const clickBucket = growthBucket(clickChange);
  if (clickBucket === "none") {
    details.push({
      label: "クリック成長",
      points: null,
      maxPoints: 3,
      evidence: "比較データなし",
      available: false,
    });
  } else {
    clickPoints =
      clickBucket === "up20"
        ? 3
        : clickBucket === "up0"
          ? 2
          : clickBucket === "down20"
            ? 1
            : 0;
    details.push({
      label: "クリック成長",
      points: clickPoints,
      maxPoints: 3,
      evidence: `前期間比 ${clickChange!.toFixed(1)}%`,
      available: true,
    });
  }

  const impressionChange =
    previous && previous.impressions > 0
      ? computeChangePercent(current.impressions, previous.impressions)
      : previous && previous.impressions === 0 && current.impressions > 0
        ? 100
        : null;
  let impressionPoints: number | null = null;
  const impressionBucket = growthBucket(impressionChange);
  if (impressionBucket === "none") {
    details.push({
      label: "表示回数成長",
      points: null,
      maxPoints: 3,
      evidence: "比較データなし",
      available: false,
    });
  } else {
    impressionPoints =
      impressionBucket === "up20"
        ? 3
        : impressionBucket === "up0"
          ? 2
          : impressionBucket === "down20"
            ? 1
            : 0;
    details.push({
      label: "表示回数成長",
      points: impressionPoints,
      maxPoints: 3,
      evidence: `前期間比 ${impressionChange!.toFixed(1)}%`,
      available: true,
    });
  }

  const availableDetails = details.filter((detail) => detail.available);
  if (availableDetails.length === 0) {
    return {
      key: "searchConsole",
      label: "Search Console",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "未取得",
      evidence: "採点可能な指標がありません",
      improvement: "Search Consoleデータを再取得してください",
      details,
      calculatedAt: now,
    };
  }

  const earned = availableDetails.reduce(
    (sum, detail) => sum + (detail.points ?? 0),
    0,
  );
  const availableMax = availableDetails.reduce(
    (sum, detail) => sum + detail.maxPoints,
    0,
  );
  const scaled = Math.round((earned / availableMax) * maxPoints);

  return {
    key: "searchConsole",
    label: "Search Console",
    points: scaled,
    maxPoints,
    available: true,
    statusLabel: "取得済み",
    evidence: details
      .filter((detail) => detail.available)
      .map((detail) => `${detail.label} ${detail.points}/${detail.maxPoints}`)
      .join(" / "),
    improvement:
      scaled < maxPoints
        ? "CTR改善・順位8〜15位ページの内部リンク強化を優先してください"
        : "Search Console指標は良好です",
    details,
    calculatedAt: now,
  };
}

function scoreGa4(ga4: Ga4CachePayload, now: string): CategoryScore {
  const maxPoints = 15;
  if (!ga4.configured || ga4.connectionStatus === "unconfigured") {
    return {
      key: "ga4",
      label: "GA4",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "未取得",
      evidence: "GA4 APIの設定を確認してください",
      improvement: "GA4_PROPERTY_ID と Analytics 閲覧権限を設定してください",
      details: [],
      calculatedAt: now,
    };
  }

  if (ga4.connectionStatus === "error") {
    return {
      key: "ga4",
      label: "GA4",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "取得失敗",
      evidence: ga4.fetchError ?? "GA4 Data APIの取得に失敗しました",
      improvement: "プロパティ権限と API 有効化を確認してください",
      details: [],
      calculatedAt: now,
    };
  }

  const current = ga4.periods[28]?.current;
  const previous = ga4.periods[28]?.previous;
  if (!current || (current.users === 0 && current.pageViews === 0)) {
    return {
      key: "ga4",
      label: "GA4",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "未取得",
      evidence: "直近28日のGA4データがありません",
      improvement: "計測タグとプロパティ設定を確認してください",
      details: [],
      calculatedAt: now,
    };
  }

  const details: ScoreDetailLine[] = [];
  const userChange = computeChangePercent(current.users, previous.users);
  let organicPoints = 0;
  if (userChange == null && previous.users === 0 && current.users === 0) {
    details.push({
      label: "ユーザー成長",
      points: null,
      maxPoints: 5,
      evidence: "比較データなし",
      available: false,
    });
  } else {
    const change = userChange ?? (current.users > 0 ? 100 : 0);
    if (change >= 20) organicPoints = 5;
    else if (change >= 5) organicPoints = 4;
    else if (change >= 0) organicPoints = 3;
    else if (change > -20) organicPoints = 1;
    else organicPoints = 0;
    details.push({
      label: "ユーザー成長",
      points: organicPoints,
      maxPoints: 5,
      evidence: `前期間比 ${change.toFixed(1)}%`,
      available: true,
    });
  }

  const pvChange = computeChangePercent(current.pageViews, previous.pageViews);
  let pvPoints = 0;
  if (pvChange == null && previous.pageViews === 0 && current.pageViews === 0) {
    details.push({
      label: "PV成長",
      points: null,
      maxPoints: 4,
      evidence: "比較データなし",
      available: false,
    });
  } else {
    const change = pvChange ?? (current.pageViews > 0 ? 100 : 0);
    if (change >= 20) pvPoints = 4;
    else if (change >= 5) pvPoints = 3;
    else if (change >= 0) pvPoints = 2;
    else pvPoints = 0;
    details.push({
      label: "PV成長",
      points: pvPoints,
      maxPoints: 4,
      evidence: `前期間比 ${change.toFixed(1)}%`,
      available: true,
    });
  }

  const engagement = current.avgEngagementSeconds;
  const engagementPoints =
    engagement >= 120 ? 3 : engagement >= 60 ? 2 : engagement >= 30 ? 1 : 0;
  details.push({
    label: "平均エンゲージメント時間",
    points: engagementPoints,
    maxPoints: 3,
    evidence: `${Math.round(engagement)}秒`,
    available: true,
  });

  const pps = current.pagesPerSession;
  const ppsPoints = pps >= 2.5 ? 3 : pps >= 2.0 ? 2 : pps >= 1.5 ? 1 : 0;
  details.push({
    label: "ページ/セッション",
    points: ppsPoints,
    maxPoints: 3,
    evidence: pps.toFixed(2),
    available: true,
  });

  const availableDetails = details.filter((detail) => detail.available);
  const earned = availableDetails.reduce(
    (sum, detail) => sum + (detail.points ?? 0),
    0,
  );
  const availableMax = availableDetails.reduce(
    (sum, detail) => sum + detail.maxPoints,
    0,
  );
  const scaled =
    availableMax > 0 ? Math.round((earned / availableMax) * maxPoints) : null;

  return {
    key: "ga4",
    label: "GA4",
    points: scaled,
    maxPoints,
    available: scaled != null,
    statusLabel: scaled != null ? "取得済み" : "未取得",
    evidence: details
      .filter((detail) => detail.available)
      .map((detail) => `${detail.label} ${detail.points}/${detail.maxPoints}`)
      .join(" / "),
    improvement:
      scaled != null && scaled < maxPoints
        ? "関連リンク追加で回遊とエンゲージメントを改善してください"
        : "GA4指標は良好です",
    details,
    calculatedAt: now,
  };
}

async function scoreIndex(seo: SeoCachePayload, now: string): Promise<CategoryScore> {
  const maxPoints = 25;
  const indexed = seo.index.indexedPages;
  if (indexed == null) {
    return {
      key: "indexRate",
      label: "インデックス",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "未取得",
      evidence: "Google登録ページ数を取得できません",
      improvement: "サイトマップまたは Search Console の登録状況を更新してください",
      details: [],
      calculatedAt: now,
    };
  }

  const entries = await getSitemapEntries();
  const indexableCount = entries.length;
  const rate = indexableCount > 0 ? indexed / indexableCount : null;
  const estimated = seo.index.indexedSource !== "unavailable";

  let points = 2;
  if (rate == null) {
    return {
      key: "indexRate",
      label: "インデックス",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "未取得",
      evidence: "インデックス対象URL総数を算出できません",
      improvement: "サイトマップ生成を確認してください",
      details: [],
      calculatedAt: now,
    };
  }

  const pct = rate * 100;
  if (pct >= 90) points = 25;
  else if (pct >= 75) points = 22;
  else if (pct >= 50) points = 17;
  else if (pct >= 25) points = 10;
  else if (pct >= 10) points = 5;
  else points = 2;

  return {
    key: "indexRate",
    label: "インデックス",
    points,
    maxPoints,
    available: true,
    statusLabel: estimated ? "取得済み（推定含む）" : "取得済み",
    evidence: `登録${indexed.toLocaleString("ja-JP")} / 対象URL${indexableCount.toLocaleString("ja-JP")}（${pct.toFixed(1)}%）` +
      (seo.index.indexedSource === "sitemap" ||
      seo.index.indexedSource === "search_impressions" ||
      seo.index.indexedSource === "estimated"
        ? " ※Google登録ページ数は推定"
        : ""),
    improvement:
      pct < 50
        ? "人気作品・ランキング・新着から作品詳細への内部リンクを増やしてください"
        : "インデックス率の維持と未登録ページの棚卸しを継続してください",
    details: [
      {
        label: "インデックス率",
        points,
        maxPoints,
        evidence: `${pct.toFixed(1)}%`,
        available: true,
      },
    ],
    calculatedAt: now,
  };
}

function scoreSitemap(
  seo: SeoCachePayload,
  summary: GscSitemapSummary,
  indexableCount: number | null,
  now: string,
): CategoryScore {
  const maxPoints = 15;

  if (summary.state === "unavailable") {
    return {
      key: "sitemap",
      label: "サイトマップ",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "未取得",
      evidence: summary.message,
      improvement: "Search Console設定を完了してください",
      details: [],
      calculatedAt: now,
    };
  }

  if (summary.state === "error" || summary.state === "loading") {
    return {
      key: "sitemap",
      label: "サイトマップ",
      points: null,
      maxPoints,
      available: false,
      statusLabel: summary.state === "loading" ? "取得中" : "取得失敗",
      evidence: summary.message,
      improvement: "サイトマップ情報を再取得してください",
      details: [],
      calculatedAt: now,
    };
  }

  const existencePoints = summary.gscSubmittedCount >= 1 ? 5 : 0;
  const errorPoints =
    summary.errorCount > 0 ? 0 : summary.warningCount > 0 ? 3 : 5;

  let coveragePoints: number | null = null;
  const detected = summary.detectedUrlCount;
  if (indexableCount != null && indexableCount > 0 && detected > 0) {
    const coverage = detected / indexableCount;
    if (coverage >= 0.9) coveragePoints = 5;
    else if (coverage >= 0.75) coveragePoints = 4;
    else if (coverage >= 0.5) coveragePoints = 2;
    else coveragePoints = 0;
  }

  const details: ScoreDetailLine[] = [
    {
      label: "送信済み存在",
      points: existencePoints,
      maxPoints: 5,
      evidence: `${summary.gscSubmittedCount}件`,
      available: true,
    },
    {
      label: "エラー状態",
      points: errorPoints,
      maxPoints: 5,
      evidence: `エラー${summary.errorCount} / 警告${summary.warningCount}`,
      available: true,
    },
    {
      label: "検出URL整合性",
      points: coveragePoints,
      maxPoints: 5,
      evidence:
        coveragePoints == null
          ? "比較不可"
          : `検出${detected} / 対象${indexableCount}`,
      available: coveragePoints != null,
    },
  ];

  const availableDetails = details.filter((detail) => detail.available);
  const earned = availableDetails.reduce(
    (sum, detail) => sum + (detail.points ?? 0),
    0,
  );
  const availableMax = availableDetails.reduce(
    (sum, detail) => sum + detail.maxPoints,
    0,
  );
  const scaled = Math.round((earned / availableMax) * maxPoints);

  return {
    key: "sitemap",
    label: "サイトマップ",
    points: scaled,
    maxPoints,
    available: true,
    statusLabel: "取得済み",
    evidence: `送信済み${summary.gscSubmittedCount}件、正常${summary.healthyCount}、警告${summary.warningCount}、エラー${summary.errorCount} / サイト側生成${summary.siteGeneratedCount}件`,
    improvement:
      summary.gscSubmittedCount === 0
        ? "Search Consoleへサイトマップを送信してください"
        : summary.errorCount > 0
          ? "エラーのあるサイトマップを修正してください"
          : "サイトマップは良好です",
    details,
    calculatedAt: now,
  };
}

function scoreInternalLinks(
  audit: InternalLinkAuditResult | null,
  now: string,
): CategoryScore {
  const maxPoints = 15;
  if (!audit) {
    return {
      key: "internalLinks",
      label: "内部リンク",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "未取得",
      evidence: "内部リンク検査未実行",
      improvement: "手動更新で内部リンク検査を実行してください",
      details: [],
      calculatedAt: now,
    };
  }

  const points = Math.round(audit.achievementRate * maxPoints);
  return {
    key: "internalLinks",
    label: "内部リンク",
    points,
    maxPoints,
    available: true,
    statusLabel: "取得済み",
    evidence: `検査${audit.sampleSize}ページ、達成率${(audit.achievementRate * 100).toFixed(1)}%`,
    improvement:
      audit.achievementRate < 0.9
        ? "関連作品リンクが不足しているページを優先して改善してください"
        : "内部リンクは良好です",
    details: [
      {
        label: "達成率",
        points,
        maxPoints,
        evidence: `${audit.passedChecks}/${audit.totalChecks}`,
        available: true,
      },
    ],
    calculatedAt: audit.inspectedAt,
  };
}

function scoreStructuredData(
  audit: StructuredDataAuditResult | null,
  now: string,
): CategoryScore {
  const maxPoints = 10;
  if (!audit) {
    return {
      key: "structuredData",
      label: "構造化データ",
      points: null,
      maxPoints,
      available: false,
      statusLabel: "未取得",
      evidence: "構造化データ検査未実行",
      improvement: "手動更新で構造化データ検査を実行してください",
      details: [],
      calculatedAt: now,
    };
  }

  const points = Math.round(audit.validityRate * maxPoints * 10) / 10;
  return {
    key: "structuredData",
    label: "構造化データ",
    points,
    maxPoints,
    available: true,
    statusLabel: "取得済み",
    evidence: `検査${audit.sampleSize}、有効率${(audit.validityRate * 100).toFixed(1)}%`,
    improvement:
      audit.validityRate < 1
        ? "失敗した構造化データ種別を修正してください"
        : "構造化データは良好です",
    details: audit.checks.map((check) => ({
      label: check.label,
      points: check.ok ? 1 : 0,
      maxPoints: 1,
      evidence: check.detail,
      available: true,
    })),
    calculatedAt: audit.inspectedAt,
  };
}

export async function computeOpsSeoScore(input: {
  seo: SeoCachePayload;
  ga4: Ga4CachePayload;
  internalLinkAudit: InternalLinkAuditResult | null;
  structuredDataAudit: StructuredDataAuditResult | null;
}): Promise<OpsSeoScore> {
  const now = new Date().toISOString();
  const summary = buildGscSitemapSummary({
    configured: input.seo.configured,
    sitemaps: input.seo.sitemaps,
    fetchedAt: input.seo.sitemapStatus?.fetchedAt ?? null,
    fetchError: input.seo.sitemapStatus?.fetchError,
    worksCount: input.seo.overview.totalWorks,
    siteUrl: input.seo.siteUrl,
  });

  let indexableCount: number | null = null;
  try {
    indexableCount = (await getSitemapEntries()).length;
  } catch {
    indexableCount = null;
  }

  const categories = [
    scoreSearchConsole(input.seo, now),
    scoreGa4(input.ga4, now),
    await scoreIndex(input.seo, now),
    scoreSitemap(input.seo, summary, indexableCount, now),
    scoreInternalLinks(input.internalLinkAudit, now),
    scoreStructuredData(input.structuredDataAudit, now),
  ];

  const available = categories.filter((category) => category.available);
  const earned = available.reduce(
    (sum, category) => sum + (category.points ?? 0),
    0,
  );
  const availableMax = available.reduce(
    (sum, category) => sum + category.maxPoints,
    0,
  );
  const partial = available.length < categories.length;
  const total =
    availableMax > 0 ? Math.round((earned / availableMax) * 100) : null;

  return {
    total,
    maxPossible: 100,
    earned,
    availableMax,
    partial,
    calculatedAt: now,
    categories,
    breakdown: {
      searchConsole: categories[0].points,
      ga4: categories[1].points,
      indexRate: categories[2].points,
      sitemap: categories[3].points,
      internalLinks: categories[4].points,
      structuredData: categories[5].points,
    },
  };
}
