import "server-only";

import { unstable_cache } from "next/cache";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { applyLiveStatusToItem } from "@/lib/dmm/work-live-status/map";
import { supabaseFetchLiveStatusByCids } from "@/lib/dmm/work-live-status/supabase-store";
import type { DmmItem } from "@/lib/dmm/types";
import { workMasterRowToDmmItem } from "@/lib/dmm/works-master/map";
import {
  getConfiguredWorksMasterBackend,
  isWorksMasterSupabaseConfigured,
  type WorkMasterRow,
} from "@/lib/dmm/works-master/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { incrPerfCounter, measureAsync } from "@/lib/perf/measure";
import { WORKS_LIST_PAGE_SIZE } from "@/lib/pagination";
import { isWorksListSaleQuery } from "@/lib/dmm/sale-price";
import type {
  WorkFilterOption,
  WorksListQueryState,
} from "@/lib/works/list-filters";
import {
  DEFAULT_CATALOG_SORT_OPTIONS,
  parseWorkSortParam,
  SALE_DEFAULT_WORK_SORT,
  type WorkSortKey,
  type WorkSortOption,
} from "@/lib/works/sort";
import { mapPageItemsToWorkCards } from "@/lib/works/paginated-work-list";
import type { WorkListCardItem } from "@/lib/works/work-list-card-item.types";

export type PublicWorksListPageData = {
  pageItems: WorkListCardItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  genreOptions: WorkFilterOption[];
  makerOptions: WorkFilterOption[];
  sortOptions: WorkSortOption[];
};

const WORKS_MASTER_CACHE_TAG = "works-master";
const PUBLIC_WORKS_LIST_TAG = "public-works-list";
const WORKS_TABLE = "works";
const LIVE_TABLE = "work_live_status";
/** 本番 DB に CMS 列（manual_hidden/deleted_at）が未適用でも動く最小 SELECT */
const LIST_SELECT =
  "cid,slug,title,description,package_image,image_status,sample_images,actresses,maker,label,series,genres,release_date,duration,product_code,affiliate_url,published,created_at,updated_at";

export function isPublicWorksDbQueryAvailable(): boolean {
  const backend = getConfiguredWorksMasterBackend();
  // getConfiguredWorksMasterBackend() は auto を supabase/local に解決済み
  return backend === "supabase" || isWorksMasterSupabaseConfigured();
}

function resolveSort(
  query: WorksListQueryState,
  isSalePage: boolean,
): WorkSortKey {
  if (isSalePage && !query.sort?.trim()) return SALE_DEFAULT_WORK_SORT;
  return parseWorkSortParam(query.sort);
}

function hasHeavyClientSideFilters(query: WorksListQueryState): boolean {
  const price = (query.price ?? "all").trim();
  const date = (query.date ?? "all").trim();
  return (
    Boolean(query.q?.trim()) ||
    Boolean(query.genre?.trim()) ||
    Boolean(query.genres?.trim()) ||
    Boolean(query.maker?.trim()) ||
    Boolean(query.makers?.trim()) ||
    (price !== "" && price !== "all") ||
    (date !== "" && date !== "all")
  );
}

async function rowsToLiveItems(
  rows: WorkMasterRow[],
): Promise<DmmItem[]> {
  const items = rows.map(workMasterRowToDmmItem);
  const cids = items.map((item) => item.content_id);
  const liveMap = await measureAsync("supabase.live_status.by_cids", () =>
    supabaseFetchLiveStatusByCids(cids),
  );
  incrPerfCounter("supabase.queries");
  return items.map((item) =>
    applyLiveStatusToItem(item, liveMap.get(item.content_id) ?? null),
  );
}

function parseWorkRows(data: unknown[] | null): WorkMasterRow[] {
  const rows: WorkMasterRow[] = [];
  for (const raw of data ?? []) {
    const row = normalizeWorkMasterRowFromStore(raw as Record<string, unknown>);
    if (row) rows.push(row);
  }
  return rows;
}

/** supabase-store の normalizeRow は export されていないためローカル複製 */
function normalizeWorkMasterRowFromStore(
  raw: Record<string, unknown>,
): WorkMasterRow | null {
  const cid = normalizeCatalogContentId(String(raw.cid ?? ""));
  if (!cid) return null;
  const now = new Date().toISOString();
  const asNamedList = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    const result: Array<{ id?: number; name: string; ruby?: string }> = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const obj = entry as { id?: number; name?: string; ruby?: string };
      const name = obj.name?.trim();
      if (!name) continue;
      result.push({
        id: typeof obj.id === "number" ? obj.id : undefined,
        name,
        ruby: obj.ruby?.trim() || undefined,
      });
    }
    return result;
  };
  const imageStatusRaw = String(raw.image_status ?? "").trim();
  const image_status =
    imageStatusRaw === "ok" ||
    imageStatusRaw === "now_printing" ||
    imageStatusRaw === "fetch_failed"
      ? imageStatusRaw
      : null;

  return {
    cid,
    slug: String(raw.slug ?? cid).trim() || cid,
    title: String(raw.title ?? cid).trim() || cid,
    description: raw.description == null ? null : String(raw.description),
    package_image:
      raw.package_image == null ? null : String(raw.package_image),
    image_status,
    image_status_checked_at:
      raw.image_status_checked_at == null
        ? null
        : String(raw.image_status_checked_at),
    sample_images: Array.isArray(raw.sample_images)
      ? raw.sample_images.filter((url): url is string => typeof url === "string")
      : [],
    actresses: asNamedList(raw.actresses),
    maker: raw.maker == null ? null : String(raw.maker),
    label: raw.label == null ? null : String(raw.label),
    series: raw.series == null ? null : String(raw.series),
    genres: asNamedList(raw.genres),
    release_date: raw.release_date == null ? null : String(raw.release_date),
    duration: raw.duration == null ? null : String(raw.duration),
    product_code: raw.product_code == null ? null : String(raw.product_code),
    affiliate_url: raw.affiliate_url == null ? null : String(raw.affiliate_url),
    published: raw.published !== false,
    manual_hidden: raw.manual_hidden === true,
    manual_hidden_reason:
      raw.manual_hidden_reason == null
        ? null
        : String(raw.manual_hidden_reason),
    deleted_at: raw.deleted_at == null ? null : String(raw.deleted_at),
    created_at: raw.created_at == null ? now : String(raw.created_at),
    updated_at: raw.updated_at == null ? now : String(raw.updated_at),
  };
}

async function fetchWorksByCidsOrdered(
  cids: string[],
): Promise<WorkMasterRow[]> {
  const client = getSupabaseServiceClient();
  if (!client || cids.length === 0) return [];

  const { data, error } = await client
    .from(WORKS_TABLE)
    .select(LIST_SELECT)
    .in("cid", cids)
    .eq("published", true);

  incrPerfCounter("supabase.queries");
  if (error) {
    console.warn("[public-list] fetch by cid failed", error.message);
    return [];
  }

  const map = new Map<string, WorkMasterRow>();
  for (const row of parseWorkRows(data)) {
    if (row.image_status === "now_printing" || row.image_status === "fetch_failed") {
      continue;
    }
    map.set(row.cid, row);
  }
  return cids.map((cid) => map.get(cid)).filter((row): row is WorkMasterRow => Boolean(row));
}

/** 新着・人気・セールなど単純ソートの1ページ分 */
export async function fetchPublicWorksPage(options: {
  sort: WorkSortKey;
  page: number;
  pageSize?: number;
  saleOnly?: boolean;
}): Promise<{ items: DmmItem[]; totalItems: number }> {
  const pageSize = options.pageSize ?? WORKS_LIST_PAGE_SIZE;
  const page = Math.max(1, options.page);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const client = getSupabaseServiceClient();
  if (!client) return { items: [], totalItems: 0 };

  return measureAsync(`public.works.page.${options.sort}`, async () => {
    // セール / 人気 / 割引率は live_status 起点
    if (
      options.saleOnly ||
      options.sort === "popular" ||
      options.sort === "discount-desc" ||
      options.sort === "price-asc" ||
      options.sort === "price-desc"
    ) {
      let liveQuery = client
        .from(LIVE_TABLE)
        .select("cid", { count: "exact" })
        .eq("is_available", true);

      if (options.saleOnly || options.sort === "discount-desc") {
        liveQuery = liveQuery.eq("is_sale", true);
      }

      if (options.sort === "popular") {
        liveQuery = liveQuery
          .not("popularity_rank", "is", null)
          .order("popularity_rank", { ascending: true });
      } else if (options.sort === "discount-desc") {
        liveQuery = liveQuery.order("discount_rate", {
          ascending: false,
          nullsFirst: false,
        });
      } else if (options.sort === "price-asc") {
        liveQuery = liveQuery
          .not("price", "is", null)
          .order("price", { ascending: true });
      } else if (options.sort === "price-desc") {
        liveQuery = liveQuery
          .not("price", "is", null)
          .order("price", { ascending: false });
      } else {
        liveQuery = liveQuery.order("updated_at", { ascending: false });
      }

      const { data, count, error } = await liveQuery.range(from, to);
      incrPerfCounter("supabase.queries");
      if (error) {
        console.warn("[public-list] live page failed", error.message);
        return { items: [], totalItems: 0 };
      }

      const cids = (data ?? [])
        .map((row) =>
          normalizeCatalogContentId(String((row as { cid?: string }).cid ?? "")),
        )
        .filter((cid): cid is string => Boolean(cid));
      const rows = await fetchWorksByCidsOrdered(cids);
      const items = await rowsToLiveItems(rows);
      return { items, totalItems: count ?? items.length };
    }

    // 新着・追加順・再生時間など works テーブル起点
    let worksQuery = client
      .from(WORKS_TABLE)
      .select(LIST_SELECT, { count: "exact" })
      .eq("published", true)
      .or("image_status.eq.ok,image_status.is.null");

    if (options.sort === "release-desc" || options.sort === "new") {
      worksQuery = worksQuery
        .order("release_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    } else if (options.sort === "added") {
      worksQuery = worksQuery.order("created_at", { ascending: false });
    } else if (options.sort === "duration-desc") {
      worksQuery = worksQuery.order("duration", {
        ascending: false,
        nullsFirst: false,
      });
    } else {
      worksQuery = worksQuery
        .order("release_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    }

    const { data, count, error } = await worksQuery.range(from, to);
    incrPerfCounter("supabase.queries");
    if (error) {
      console.warn("[public-list] works page failed", error.message);
      return { items: [], totalItems: 0 };
    }

    const rows = parseWorkRows(data).filter(
      (row) =>
        row.image_status !== "now_printing" &&
        row.image_status !== "fetch_failed",
    );
    const items = await rowsToLiveItems(rows);
    return { items, totalItems: count ?? items.length };
  });
}

/** TOP/ランキング用の少量取得（キャッシュ付き） */
export async function fetchCachedPublicWorksSlice(options: {
  sort: WorkSortKey;
  limit: number;
  saleOnly?: boolean;
  revalidateSec?: number;
  cacheKey: string;
}): Promise<DmmItem[]> {
  const revalidateSec = options.revalidateSec ?? 900;
  const cached = unstable_cache(
    async () => {
      const { items } = await fetchPublicWorksPage({
        sort: options.sort,
        page: 1,
        pageSize: options.limit,
        saleOnly: options.saleOnly,
      });
      if (items.length === 0) {
        throw new Error("public-slice-empty");
      }
      return items;
    },
    [
      "public-works-slice-v2",
      options.cacheKey,
      options.sort,
      String(options.limit),
      options.saleOnly ? "sale" : "all",
    ],
    {
      revalidate: revalidateSec,
      tags: [WORKS_MASTER_CACHE_TAG, PUBLIC_WORKS_LIST_TAG],
    },
  );
  try {
    return await cached();
  } catch {
    const { items } = await fetchPublicWorksPage({
      sort: options.sort,
      page: 1,
      pageSize: options.limit,
      saleOnly: options.saleOnly,
    });
    return items;
  }
}

async function fetchFilterOptionsUncached(): Promise<{
  genreOptions: WorkFilterOption[];
  makerOptions: WorkFilterOption[];
}> {
  const client = getSupabaseServiceClient();
  if (!client) return { genreOptions: [], makerOptions: [] };

  const genreCounts = new Map<string, number>();
  const makerCounts = new Map<string, number>();
  const PAGE = 1000;
  // フィルター用は全件走査せず最大3ページ分で近似（初回TTFBを守る）
  const MAX_PAGES = 1;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE;
    const to = from + PAGE - 1;
    const { data, error } = await client
      .from(WORKS_TABLE)
      .select("maker,genres")
      .eq("published", true)
      .or("image_status.eq.ok,image_status.is.null")
      .order("updated_at", { ascending: false })
      .range(from, to);
    incrPerfCounter("supabase.queries");
    if (error) {
      console.warn("[public-list] filter options failed", error.message);
      break;
    }
    const batch = data ?? [];
    for (const raw of batch) {
      const maker = String((raw as { maker?: string }).maker ?? "").trim();
      if (maker) makerCounts.set(maker, (makerCounts.get(maker) ?? 0) + 1);
      const genres = (raw as { genres?: unknown }).genres;
      if (Array.isArray(genres)) {
        for (const entry of genres) {
          const name =
            entry && typeof entry === "object"
              ? String((entry as { name?: string }).name ?? "").trim()
              : "";
          if (name) genreCounts.set(name, (genreCounts.get(name) ?? 0) + 1);
        }
      }
    }
    if (batch.length < PAGE) break;
  }

  const toOptions = (counts: Map<string, number>): WorkFilterOption[] =>
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .map(([label, count]) => ({ label, value: label, count }));

  return {
    genreOptions: toOptions(genreCounts),
    makerOptions: toOptions(makerCounts),
  };
}

export async function getCachedWorkFilterOptions(): Promise<{
  genreOptions: WorkFilterOption[];
  makerOptions: WorkFilterOption[];
}> {
  const cached = unstable_cache(
    fetchFilterOptionsUncached,
    ["public-work-filter-options-v2"],
    {
      revalidate: 21600,
      tags: [WORKS_MASTER_CACHE_TAG, "public-work-filter-options"],
    },
  );
  try {
    return await cached();
  } catch {
    return { genreOptions: [], makerOptions: [] };
  }
}

/**
 * 公開作品一覧。単純ソートは DB 側で range 取得。
 * 複雑な絞り込みは呼び出し側でカタログフォールバック。
 */
export async function tryGetWorksListPageDataFromDb(
  query: WorksListQueryState,
): Promise<PublicWorksListPageData | null> {
  if (!isPublicWorksDbQueryAvailable()) return null;
  if (hasHeavyClientSideFilters(query)) return null;

  const isSalePage = isWorksListSaleQuery(query);
  const sort = resolveSort(query, isSalePage);
  const page = Math.max(1, Number(query.page) || 1);

  // random / views は DB 単体では再現が難しいためフォールバック
  if (
    sort === "random" ||
    sort === "today-views" ||
    sort === "total-views"
  ) {
    return null;
  }

  const cacheKey = [
    "works-list-v2",
    sort,
    isSalePage ? "sale" : "all",
    String(page),
    String(WORKS_LIST_PAGE_SIZE),
  ].join(":");

  const cached = unstable_cache(
    async () => {
      const { items, totalItems } = await fetchPublicWorksPage({
        sort,
        page,
        pageSize: WORKS_LIST_PAGE_SIZE,
        saleOnly: isSalePage,
      });
      if (items.length === 0 && totalItems === 0) {
        // 空結果を Data Cache に残さない（throw でキャッシュ回避）
        throw new Error("public-list-empty");
      }
      const totalPages = Math.max(1, Math.ceil(totalItems / WORKS_LIST_PAGE_SIZE));
      return {
        pageItems: mapPageItemsToWorkCards(items, {
          includeSaleInfo: isSalePage,
        }),
        totalItems,
        totalPages,
        currentPage: Math.min(page, totalPages),
        sortOptions: isSalePage
          ? [
              ...DEFAULT_CATALOG_SORT_OPTIONS,
              { key: "discount-desc" as const, label: "割引率が高い順" },
            ]
          : DEFAULT_CATALOG_SORT_OPTIONS,
      };
    },
    [cacheKey],
    {
      revalidate: isSalePage
        ? 300
        : sort === "release-desc" || sort === "new"
          ? 600
          : 900,
      tags: [WORKS_MASTER_CACHE_TAG, PUBLIC_WORKS_LIST_TAG, cacheKey],
    },
  );

  try {
    const [list, filterOptions] = await Promise.all([
      cached(),
      getCachedWorkFilterOptions(),
    ]);
    return {
      ...list,
      genreOptions: filterOptions.genreOptions,
      makerOptions: filterOptions.makerOptions,
    };
  } catch (error) {
    console.warn("[public-list] cached list failed", error);
    return null;
  }
}
