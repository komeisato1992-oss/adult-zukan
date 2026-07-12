/** SEO データソース識別子（将来 Bing / GA4 等を追加） */
export type SeoDataSource = "google_search_console";

export type SeoPeriodDays = 7 | 28 | 90;

export type SeoMetricAvailability =
  | "available"
  | "unfetched"
  | "error"
  | "empty"
  | "unsupported";

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
  | "search"
  | "other";

export type SeoPeriodMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SeoPeriodBundle = {
  current: SeoPeriodMetrics;
  previous: SeoPeriodMetrics;
  queries: SeoQueryRow[];
  previousQueries: SeoQueryRow[];
  pages: SeoPageRow[];
  previousPages: SeoPageRow[];
};

export type SeoIndexSource = "sitemap" | "search_impressions" | "estimated" | "unavailable";

export type SeoIndexSnapshot = {
  indexedPages: number | null;
  notIndexedPages: number | null;
  excludedPages: number;
  totalSitePages: number;
  registrationRate: number | null;
  indexedSource: SeoIndexSource;
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
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  contentTypes?: string[];
  videoSubmitted?: number;
  typeLabel?: string;
};

export type SeoEntitySitemapId =
  | "works"
  | "actresses"
  | "makers"
  | "labels"
  | "series"
  | "genres";

export type SeoEntityPageCounts = Record<SeoEntitySitemapId, number>;

export type SeoSitemapSubmissionStatus = "success" | "pending" | "fetch_error";

export type SeoEntitySitemapStatus = {
  id: string;
  label: string;
  displayName: string;
  pathSuffix: string;
  submitUrl: string;
  kind: "index" | "urlset";
  status: SeoSitemapSubmissionStatus;
  siteUrlCount: number | null;
  indexedCount: number | null;
  contentsCount: number | null;
  notIndexedCount: number | null;
  lastGeneratedAt: string | null;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  googleSubmittedAt: string | null;
  errors: number;
  warnings: number;
  isPending: boolean | null;
  httpStatus: number | null;
  localCount: number;
  coverageRate: number | null;
};

export type SitemapPostImportResult = {
  sitemapUpdated: boolean;
  sitemapError?: string;
  googleSubmission: {
    submitted: boolean;
    skipped: boolean;
    reason: string | null;
    dryRun?: boolean;
  };
  refreshResults?: Array<{
    key: string;
    urlCount: number;
    addedCount: number | null;
  }>;
};

export type SitemapAdminActionResult = {
  refresh?: {
    key: string;
    label: string;
    url: string;
    urlCount: number;
    previousUrlCount: number | null;
    addedCount: number | null;
    duplicateCount: number;
    httpStatus: number;
    generatedAt: string;
    message: string;
  };
  submit?: {
    submitted: boolean;
    skipped: boolean;
    reason: string | null;
    sitemapUrl: string;
    submittedAt: string | null;
    dryRun: boolean;
    message: string;
  };
};

export type SeoSitemapStatusSnapshot = {
  fetchedAt: string | null;
  fetchError?: string;
  /** GSC sitemaps.list の実件数（サイト側生成数とは別） */
  gscSubmittedCount?: number;
  rows: SeoEntitySitemapStatus[];
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

export type SeoWeeklySuggestion = {
  id: string;
  text: string;
  targetTab?: SeoTabId;
  targetChanceTab?: SeoChanceTabId;
};

export type SeoOpportunityRow = {
  id: string;
  kind: "query" | "page";
  label: string;
  url?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  reason: string;
  changePercent?: number | null;
  isNew?: boolean;
};

export type SeoRisingQueryRow = {
  rank: number;
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  changePercent: number | null;
  isNew: boolean;
};

export type SeoEntityRankingRow = {
  slug: string;
  name: string;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  changePercent: number | null;
  workCount: number | null;
};

export type SeoNewWorkStatus = "has_search_data" | "no_search_data" | "pending";

export type SeoNewWorkRow = {
  contentId: string;
  title: string;
  addedAt: string;
  url: string;
  impressions: number;
  clicks: number;
  position: number;
  status: SeoNewWorkStatus;
};

export type SeoNewWorksSummary = {
  added7d: number;
  added28d: number;
  withSearchData: number;
  withoutSearchData: number;
  rows: SeoNewWorkRow[];
};

export type SeoConnectionStatus = "connected" | "error" | "unconfigured";

export type SeoOverviewStats = {
  totalWorks: number;
  indexedPages: number | null;
  notIndexedPages: number | null;
  clicks28d: number;
  impressions28d: number;
  ctr28d: number;
  position28d: number;
};

export type SeoCachePayload = {
  version: 2;
  source: SeoDataSource;
  siteUrl: string;
  updatedAt: string | null;
  configured: boolean;
  configMessage?: string;
  connectionStatus: SeoConnectionStatus;
  fetchError?: string;
  stale?: boolean;
  overview: SeoOverviewStats;
  periods: Record<SeoPeriodDays, SeoPeriodBundle>;
  dailyStats: SeoDailyStat[];
  /** @deprecated periods[28].queries を使用 */
  queries: SeoQueryRow[];
  /** @deprecated periods[28].pages を使用 */
  pages: SeoPageRow[];
  index: SeoIndexSnapshot;
  sitemaps: SeoSitemapRow[];
  sitemapStatus: SeoSitemapStatusSnapshot;
  entityPageCounts: SeoEntityPageCounts;
  crawlErrors: SeoCrawlErrorGroup[];
  newWorks: SeoNewWorksSummary;
  entityWorkCounts: {
    actresses: Record<string, number>;
    makers: Record<string, number>;
    genres: Record<string, number>;
  };
};

export type SeoTabId =
  | "overview"
  | "queries"
  | "pages"
  | "index"
  | "sitemaps"
  | "crawl-errors";

export type SeoChanceTabId =
  | "ctr"
  | "page2"
  | "rising"
  | "declining";

export const SEO_TABS: Array<{ id: SeoTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "queries", label: "検索パフォーマンス" },
  { id: "pages", label: "人気ページ" },
  { id: "index", label: "インデックス" },
  { id: "sitemaps", label: "サイトマップ" },
  { id: "crawl-errors", label: "クロールエラー" },
];

export const SEO_CHANCE_TABS: Array<{ id: SeoChanceTabId; label: string }> = [
  { id: "ctr", label: "CTR改善" },
  { id: "page2", label: "11〜20位" },
  { id: "rising", label: "急上昇" },
  { id: "declining", label: "流入減少" },
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

export const SEO_PAGE_TYPE_LABELS: Record<SeoPageType, string> = {
  work: "作品",
  actress: "女優",
  maker: "メーカー",
  genre: "ジャンル",
  series: "シリーズ",
  label: "レーベル",
  ranking: "ランキング",
  search: "検索",
  other: "その他",
};
