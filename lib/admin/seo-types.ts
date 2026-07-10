/** SEO データソース識別子（将来 Bing / GA4 等を追加） */
export type SeoDataSource = "google_search_console";

export type SeoPeriodDays = 7 | 28 | 90;

export type SeoDailyStat = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  indexedPages?: number;
};

export type SeoQueryRow = {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SeoPageRow = {
  url: string;
  title: string;
  pageType: SeoPageType;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SeoPageType =
  | "work"
  | "actress"
  | "maker"
  | "genre"
  | "series"
  | "label"
  | "ranking"
  | "other";

export type SeoIndexSnapshot = {
  indexedPages: number;
  notIndexedPages: number;
  excludedPages: number;
  totalSitePages: number;
  history: SeoIndexHistoryPoint[];
};

export type SeoIndexHistoryPoint = {
  date: string;
  indexedPages: number;
  notIndexedPages: number;
  excludedPages: number;
};

export type SeoSitemapRow = {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  contentsCount: number;
  indexedCount: number;
  errors: number;
  warnings: number;
};

export type SeoCrawlErrorType =
  | "404"
  | "500"
  | "redirect"
  | "canonical"
  | "robots"
  | "noindex"
  | "duplicate";

export type SeoCrawlErrorGroup = {
  type: SeoCrawlErrorType;
  label: string;
  count: number;
  urls: string[];
};

export type SeoAiSuggestion = {
  id: string;
  severity: "info" | "warning" | "opportunity";
  title: string;
  body: string;
  createdAt: string;
};

export type SeoOverviewStats = {
  totalWorks: number;
  indexedPages: number;
  clicks28d: number;
  impressions28d: number;
  ctr28d: number;
  position28d: number;
};

export type SeoCachePayload = {
  version: 1;
  source: SeoDataSource;
  siteUrl: string;
  updatedAt: string | null;
  configured: boolean;
  configMessage?: string;
  overview: SeoOverviewStats;
  dailyStats: SeoDailyStat[];
  queries: SeoQueryRow[];
  pages: SeoPageRow[];
  index: SeoIndexSnapshot;
  sitemaps: SeoSitemapRow[];
  crawlErrors: SeoCrawlErrorGroup[];
  aiSuggestions: SeoAiSuggestion[];
};

export type SeoTabId =
  | "overview"
  | "queries"
  | "pages"
  | "index"
  | "sitemaps"
  | "crawl-errors";

export const SEO_TABS: Array<{ id: SeoTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "queries", label: "検索パフォーマンス" },
  { id: "pages", label: "人気ページ" },
  { id: "index", label: "インデックス" },
  { id: "sitemaps", label: "サイトマップ" },
  { id: "crawl-errors", label: "クロールエラー" },
];

export const SEO_CRAWL_ERROR_LABELS: Record<SeoCrawlErrorType, string> = {
  "404": "404",
  "500": "500",
  redirect: "Redirect",
  canonical: "Canonical",
  robots: "robots",
  noindex: "noindex",
  duplicate: "Duplicate",
};
