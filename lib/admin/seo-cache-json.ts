import type {
  SeoCachePayload,
  SeoNewWorksSummary,
  SeoNewWorkStatus,
  SeoPeriodBundle,
  SeoPeriodDays,
} from "@/lib/admin/seo-types";

export class SeoCacheJsonError extends Error {
  status = 500;

  constructor(message: string) {
    super(message);
    this.name = "SeoCacheJsonError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function emptyPeriodMetrics() {
  return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
}

function emptyPeriodBundle(): SeoPeriodBundle {
  return {
    current: emptyPeriodMetrics(),
    previous: emptyPeriodMetrics(),
    queries: [],
    previousQueries: [],
    pages: [],
    previousPages: [],
  };
}

function parseDailyStats(raw: unknown): SeoCachePayload["dailyStats"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      date: readString(row.date),
      clicks: readNumber(row.clicks),
      impressions: readNumber(row.impressions),
      ctr: readNumber(row.ctr),
      position: readNumber(row.position),
      indexedPages:
        typeof row.indexedPages === "number" ? row.indexedPages : undefined,
    }))
    .filter((row) => row.date.length > 0);
}

function parseQueries(raw: unknown): SeoCachePayload["queries"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      keyword: readString(row.keyword),
      clicks: readNumber(row.clicks),
      impressions: readNumber(row.impressions),
      ctr: readNumber(row.ctr),
      position: readNumber(row.position),
    }))
    .filter((row) => row.keyword.length > 0);
}

function parsePages(raw: unknown): SeoCachePayload["pages"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      url: readString(row.url),
      title: readString(row.title),
      pageType: readString(row.pageType, "other") as SeoCachePayload["pages"][number]["pageType"],
      clicks: readNumber(row.clicks),
      impressions: readNumber(row.impressions),
      ctr: readNumber(row.ctr),
      position: readNumber(row.position),
    }))
    .filter((row) => row.url.length > 0);
}

function parsePeriodMetrics(raw: unknown) {
  if (!isRecord(raw)) return emptyPeriodMetrics();
  return {
    clicks: readNumber(raw.clicks),
    impressions: readNumber(raw.impressions),
    ctr: readNumber(raw.ctr),
    position: readNumber(raw.position),
  };
}

function parsePeriodBundle(raw: unknown): SeoPeriodBundle {
  if (!isRecord(raw)) return emptyPeriodBundle();
  return {
    current: parsePeriodMetrics(raw.current),
    previous: parsePeriodMetrics(raw.previous),
    queries: parseQueries(raw.queries),
    previousQueries: parseQueries(raw.previousQueries),
    pages: parsePages(raw.pages),
    previousPages: parsePages(raw.previousPages),
  };
}

function parsePeriods(raw: unknown, fallback28: SeoPeriodBundle): Record<SeoPeriodDays, SeoPeriodBundle> {
  if (!isRecord(raw)) {
    return { 7: emptyPeriodBundle(), 28: fallback28, 90: emptyPeriodBundle() };
  }
  return {
    7: parsePeriodBundle(raw["7"]),
    28: isRecord(raw["28"]) ? parsePeriodBundle(raw["28"]) : fallback28,
    90: parsePeriodBundle(raw["90"]),
  };
}

function parseIndex(raw: unknown): SeoCachePayload["index"] {
  if (!isRecord(raw)) {
    return {
      indexedPages: null,
      notIndexedPages: null,
      excludedPages: 0,
      totalSitePages: 0,
      registrationRate: null,
      indexedSource: "unavailable",
      history: [],
    };
  }

  const historyRaw = Array.isArray(raw.history) ? raw.history : [];
  const indexedPages = readNullableNumber(raw.indexedPages);
  const totalSitePages = readNumber(raw.totalSitePages);
  const registrationRate =
    indexedPages !== null && totalSitePages > 0
      ? indexedPages / totalSitePages
      : readNullableNumber(raw.registrationRate);

  return {
    indexedPages,
    notIndexedPages: readNullableNumber(raw.notIndexedPages),
    excludedPages: readNumber(raw.excludedPages),
    totalSitePages,
    registrationRate,
    indexedSource:
      raw.indexedSource === "sitemap" ||
      raw.indexedSource === "search_impressions" ||
      raw.indexedSource === "estimated" ||
      raw.indexedSource === "unavailable"
        ? raw.indexedSource
        : "estimated",
    history: historyRaw
      .filter(isRecord)
      .map((point) => ({
        date: readString(point.date),
        indexedPages: readNumber(point.indexedPages),
        notIndexedPages: readNumber(point.notIndexedPages),
        excludedPages: readNumber(point.excludedPages),
      }))
      .filter((point) => point.date.length > 0),
  };
}

function parseSitemaps(raw: unknown): SeoCachePayload["sitemaps"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      path: readString(row.path),
      lastSubmitted: readString(row.lastSubmitted) || undefined,
      lastDownloaded: readString(row.lastDownloaded) || undefined,
      contentsCount: readNumber(row.contentsCount),
      indexedCount: readNumber(row.indexedCount),
      errors: readNumber(row.errors),
      warnings: readNumber(row.warnings),
    }))
    .filter((row) => row.path.length > 0);
}

function parseCrawlErrors(raw: unknown): SeoCachePayload["crawlErrors"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({
      type: readString(row.type, "404") as SeoCachePayload["crawlErrors"][number]["type"],
      label: readString(row.label),
      count: readNumber(row.count),
      urls: Array.isArray(row.urls)
        ? row.urls.filter((url): url is string => typeof url === "string")
        : [],
    }))
    .filter((row) => row.label.length > 0);
}

function parseOverview(raw: unknown): SeoCachePayload["overview"] {
  if (!isRecord(raw)) {
    return {
      totalWorks: 0,
      indexedPages: null,
      notIndexedPages: null,
      clicks28d: 0,
      impressions28d: 0,
      ctr28d: 0,
      position28d: 0,
    };
  }

  return {
    totalWorks: readNumber(raw.totalWorks),
    indexedPages: readNullableNumber(raw.indexedPages),
    notIndexedPages: readNullableNumber(raw.notIndexedPages),
    clicks28d: readNumber(raw.clicks28d),
    impressions28d: readNumber(raw.impressions28d),
    ctr28d: readNumber(raw.ctr28d),
    position28d: readNumber(raw.position28d),
  };
}

function parseEntityWorkCounts(raw: unknown): SeoCachePayload["entityWorkCounts"] {
  const empty = { actresses: {}, makers: {}, genres: {} };
  if (!isRecord(raw)) return empty;

  function parseMap(value: unknown): Record<string, number> {
    if (!isRecord(value)) return {};
    return Object.fromEntries(
      Object.entries(value).map(([key, count]) => [key, readNumber(count)]),
    );
  }

  return {
    actresses: parseMap(raw.actresses),
    makers: parseMap(raw.makers),
    genres: parseMap(raw.genres),
  };
}

function parseNewWorkStatus(value: unknown): SeoNewWorkStatus {
  if (
    value === "has_search_data" ||
    value === "no_search_data" ||
    value === "pending"
  ) {
    return value;
  }
  return "pending";
}

function parseNewWorks(raw: unknown): SeoNewWorksSummary {
  const empty: SeoNewWorksSummary = {
    added7d: 0,
    added28d: 0,
    withSearchData: 0,
    withoutSearchData: 0,
    rows: [],
  };
  if (!isRecord(raw)) return empty;

  const rowsRaw = Array.isArray(raw.rows) ? raw.rows : [];
  return {
    added7d: readNumber(raw.added7d),
    added28d: readNumber(raw.added28d),
    withSearchData: readNumber(raw.withSearchData),
    withoutSearchData: readNumber(raw.withoutSearchData),
    rows: rowsRaw
      .filter(isRecord)
      .map((row) => ({
        contentId: readString(row.contentId),
        title: readString(row.title),
        addedAt: readString(row.addedAt),
        url: readString(row.url),
        impressions: readNumber(row.impressions),
        clicks: readNumber(row.clicks),
        position: readNumber(row.position),
        status: parseNewWorkStatus(row.status),
      }))
      .filter((row) => row.contentId.length > 0),
  };
}

function migrateV1ToV2(parsed: Record<string, unknown>): SeoCachePayload {
  const queries = parseQueries(parsed.queries);
  const pages = parsePages(parsed.pages);
  const overview = parseOverview(parsed.overview);

  const bundle28: SeoPeriodBundle = {
    current: {
      clicks: overview.clicks28d,
      impressions: overview.impressions28d,
      ctr: overview.ctr28d,
      position: overview.position28d,
    },
    previous: emptyPeriodMetrics(),
    queries,
    previousQueries: [],
    pages,
    previousPages: [],
  };

  return {
    version: 2,
    source: "google_search_console",
    siteUrl: readString(parsed.siteUrl),
    updatedAt: readString(parsed.updatedAt) || null,
    configured: parsed.configured === true,
    configMessage:
      typeof parsed.configMessage === "string" ? parsed.configMessage : undefined,
    connectionStatus: parsed.configured === true ? "connected" : "unconfigured",
    overview,
    periods: parsePeriods(parsed.periods, bundle28),
    dailyStats: parseDailyStats(parsed.dailyStats),
    queries,
    pages,
    index: parseIndex(parsed.index),
    sitemaps: parseSitemaps(parsed.sitemaps),
    crawlErrors: parseCrawlErrors(parsed.crawlErrors),
    newWorks: parseNewWorks(parsed.newWorks),
    entityWorkCounts: parseEntityWorkCounts(parsed.entityWorkCounts),
  };
}

export function createEmptySeoCache(siteUrl: string): SeoCachePayload {
  return {
    version: 2,
    source: "google_search_console",
    siteUrl,
    updatedAt: null,
    configured: false,
    connectionStatus: "unconfigured",
    overview: {
      totalWorks: 0,
      indexedPages: null,
      notIndexedPages: null,
      clicks28d: 0,
      impressions28d: 0,
      ctr28d: 0,
      position28d: 0,
    },
    periods: {
      7: emptyPeriodBundle(),
      28: emptyPeriodBundle(),
      90: emptyPeriodBundle(),
    },
    dailyStats: [],
    queries: [],
    pages: [],
    index: {
      indexedPages: null,
      notIndexedPages: null,
      excludedPages: 0,
      totalSitePages: 0,
      registrationRate: null,
      indexedSource: "unavailable",
      history: [],
    },
    sitemaps: [],
    crawlErrors: [],
    newWorks: {
      added7d: 0,
      added28d: 0,
      withSearchData: 0,
      withoutSearchData: 0,
      rows: [],
    },
    entityWorkCounts: {
      actresses: {},
      makers: {},
      genres: {},
    },
  };
}

export function parseSeoCacheJson(raw: string): SeoCachePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SeoCacheJsonError("SEOキャッシュ JSON の解析に失敗しました。");
  }

  if (!isRecord(parsed)) {
    throw new SeoCacheJsonError("SEOキャッシュの形式が不正です。");
  }

  if (parsed.version === 1) {
    return migrateV1ToV2(parsed);
  }

  if (parsed.version !== 2) {
    throw new SeoCacheJsonError("SEOキャッシュの形式が不正です。");
  }

  return migrateV1ToV2(parsed);
}

export function serializeSeoCache(payload: SeoCachePayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
