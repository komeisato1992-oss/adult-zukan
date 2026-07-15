/**
 * 運営ダッシュボードのクライアント側マージ用（ブラウザでも利用）。
 * サーバ専用 import は入れないこと。
 */

export function parseOpsTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function sliceFreshness(options: {
  updatedAt?: string | null;
  lastSuccessfulAt?: string | null;
}): number {
  return Math.max(
    parseOpsTimestamp(options.updatedAt),
    parseOpsTimestamp(options.lastSuccessfulAt),
  );
}

export type OpsMergeablePayload = {
  generatedAt: string;
  top: {
    catalog: {
      works: number;
      actresses: number;
      makers: number;
      labels: number;
      series: number;
      genres: number;
    };
    indexedPages: number | null;
    notIndexedPages: number | null;
    indexRate: number | null;
    indexEstimated: boolean;
    indexableUrlCount: number | null;
    updatedAt: string | null;
  };
  seo: {
    updatedAt?: string | null;
    index: {
      indexedPages: number | null;
      notIndexedPages: number | null;
      registrationRate: number | null;
      indexedSource?: string;
    };
    overview?: { totalWorks?: number };
  };
  ga4: {
    updatedAt?: string | null;
    lastSuccessfulAt?: string | null;
  };
  dmm: {
    updatedAt?: string | null;
    lastSuccessfulAt?: string | null;
  };
  [key: string]: unknown;
};

/**
 * 新しいレスポンスで古い slice を上書きしない。
 * SEO / GA4 / DMM は各自の更新時刻で比較する。
 */
export function mergeOpsDashboardPayload<T extends OpsMergeablePayload>(
  current: T,
  incoming: T,
): T {
  const preferIncomingSeo =
    sliceFreshness(incoming.seo) >= sliceFreshness(current.seo);
  const preferIncomingGa4 =
    sliceFreshness(incoming.ga4) >= sliceFreshness(current.ga4);
  const preferIncomingDmm =
    sliceFreshness(incoming.dmm) >= sliceFreshness(current.dmm);
  const preferIncomingGenerated =
    parseOpsTimestamp(incoming.generatedAt) >=
    parseOpsTimestamp(current.generatedAt);

  const seo = preferIncomingSeo ? incoming.seo : current.seo;
  const ga4 = preferIncomingGa4 ? incoming.ga4 : current.ga4;
  const dmm = preferIncomingDmm ? incoming.dmm : current.dmm;
  const base = preferIncomingGenerated ? incoming : current;

  const indexedPages =
    seo.index.indexedSource === "sitemap" ||
    seo.index.indexedSource === "search_impressions"
      ? (seo.index.indexedPages ?? null)
      : null;
  const notIndexedPages =
    seo.index.indexedSource === "sitemap"
      ? (seo.index.notIndexedPages ?? null)
      : null;
  const indexableUrlCount = base.top.indexableUrlCount;
  const indexRate =
    seo.index.indexedSource === "sitemap" && seo.index.registrationRate != null
      ? seo.index.registrationRate
      : indexedPages != null &&
          indexableUrlCount != null &&
          indexableUrlCount > 0
        ? indexedPages / indexableUrlCount
        : null;

  const updatedAtCandidates = [
    seo.updatedAt,
    ga4.updatedAt,
    ga4.lastSuccessfulAt,
    dmm.updatedAt,
    dmm.lastSuccessfulAt,
    base.top.updatedAt,
  ];
  let updatedAt: string | null = null;
  let updatedAtTs = -1;
  for (const value of updatedAtCandidates) {
    const ts = parseOpsTimestamp(value);
    if (ts > updatedAtTs) {
      updatedAtTs = ts;
      updatedAt = value ?? null;
    }
  }

  const generatedAt =
    parseOpsTimestamp(incoming.generatedAt) >=
    parseOpsTimestamp(current.generatedAt)
      ? incoming.generatedAt
      : current.generatedAt;

  const catalogBase = preferIncomingGenerated
    ? incoming.top.catalog
    : current.top.catalog;
  // 掲載中作品数のセッション内下がり返し防止（別インスタンスの古いカタログ読み取り対策）
  const works = Math.max(
    current.top.catalog.works,
    incoming.top.catalog.works,
  );

  return {
    ...base,
    generatedAt,
    seo,
    ga4,
    dmm,
    top: {
      ...base.top,
      catalog: {
        ...catalogBase,
        works,
      },
      indexedPages,
      notIndexedPages,
      indexRate,
      indexEstimated: seo.index.indexedSource === "search_impressions",
      updatedAt,
    },
  };
}

/** 受信 payload が現在より全体として古ければ破棄 */
export function isOpsPayloadStaleOverall<T extends OpsMergeablePayload>(
  current: T,
  incoming: T,
): boolean {
  return (
    parseOpsTimestamp(incoming.generatedAt) <
      parseOpsTimestamp(current.generatedAt) &&
    sliceFreshness(incoming.seo) < sliceFreshness(current.seo) &&
    sliceFreshness(incoming.ga4) < sliceFreshness(current.ga4) &&
    sliceFreshness(incoming.dmm) < sliceFreshness(current.dmm)
  );
}
