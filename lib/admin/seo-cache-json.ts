import type { SeoCachePayload } from "@/lib/admin/seo-types";

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

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
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

function parseIndex(raw: unknown): SeoCachePayload["index"] {
  if (!isRecord(raw)) {
    return {
      indexedPages: 0,
      notIndexedPages: 0,
      excludedPages: 0,
      totalSitePages: 0,
      history: [],
    };
  }

  const historyRaw = Array.isArray(raw.history) ? raw.history : [];
  return {
    indexedPages: readNumber(raw.indexedPages),
    notIndexedPages: readNumber(raw.notIndexedPages),
    excludedPages: readNumber(raw.excludedPages),
    totalSitePages: readNumber(raw.totalSitePages),
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
      indexedPages: 0,
      clicks28d: 0,
      impressions28d: 0,
      ctr28d: 0,
      position28d: 0,
    };
  }

  return {
    totalWorks: readNumber(raw.totalWorks),
    indexedPages: readNumber(raw.indexedPages),
    clicks28d: readNumber(raw.clicks28d),
    impressions28d: readNumber(raw.impressions28d),
    ctr28d: readNumber(raw.ctr28d),
    position28d: readNumber(raw.position28d),
  };
}

export function createEmptySeoCache(siteUrl: string): SeoCachePayload {
  return {
    version: 1,
    source: "google_search_console",
    siteUrl,
    updatedAt: null,
    configured: false,
    overview: {
      totalWorks: 0,
      indexedPages: 0,
      clicks28d: 0,
      impressions28d: 0,
      ctr28d: 0,
      position28d: 0,
    },
    dailyStats: [],
    queries: [],
    pages: [],
    index: {
      indexedPages: 0,
      notIndexedPages: 0,
      excludedPages: 0,
      totalSitePages: 0,
      history: [],
    },
    sitemaps: [],
    crawlErrors: [],
    aiSuggestions: [],
  };
}

export function parseSeoCacheJson(raw: string): SeoCachePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SeoCacheJsonError("SEOキャッシュ JSON の解析に失敗しました。");
  }

  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new SeoCacheJsonError("SEOキャッシュの形式が不正です。");
  }

  return {
    version: 1,
    source: "google_search_console",
    siteUrl: readString(parsed.siteUrl),
    updatedAt: readString(parsed.updatedAt) || null,
    configured: parsed.configured === true,
    configMessage:
      typeof parsed.configMessage === "string" ? parsed.configMessage : undefined,
    overview: parseOverview(parsed.overview),
    dailyStats: parseDailyStats(parsed.dailyStats),
    queries: parseQueries(parsed.queries),
    pages: parsePages(parsed.pages),
    index: parseIndex(parsed.index),
    sitemaps: parseSitemaps(parsed.sitemaps),
    crawlErrors: parseCrawlErrors(parsed.crawlErrors),
    aiSuggestions: [],
  };
}

export function serializeSeoCache(payload: SeoCachePayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
