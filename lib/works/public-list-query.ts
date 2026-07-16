import "server-only";

import { unstable_cache } from "next/cache";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { applyLiveStatusToItem } from "@/lib/dmm/work-live-status/map";
import { supabaseFetchLiveStatusByCids } from "@/lib/dmm/work-live-status/supabase-store";
import type { WorkLiveStatusRow } from "@/lib/dmm/work-live-status/types";
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
  getAppliedGenres,
  getAppliedMakers,
} from "@/lib/works/list-filters";
import {
  DEFAULT_CATALOG_SORT_OPTIONS,
  getTokyoDateString,
  isReleasedOnOrBefore,
  parseWorkSortParam,
  SALE_DEFAULT_WORK_SORT,
  type WorkSortKey,
  type WorkSortOption,
  WORK_SORT_LABELS,
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
const LIST_SELECT =
  "cid,slug,title,description,package_image,image_status,sample_images,actresses,maker,label,series,genres,release_date,duration,product_code,affiliate_url,published,created_at,updated_at";

let priceAmountColumnAvailable: boolean | null = null;
let durationMinutesColumnAvailable: boolean | null = null;
let listRpcAvailable: boolean | null = null;

/**
 * price_amount 未適用環境向けフォールバック。
 * backfill が現在価格（円）を new_arrival_rank に格納する。
 */
const PRICE_SORT_FALLBACK_COLUMN = "new_arrival_rank";

export function isPublicWorksDbQueryAvailable(): boolean {
  const backend = getConfiguredWorksMasterBackend();
  return backend === "supabase" || isWorksMasterSupabaseConfigured();
}

function resolveSort(
  query: WorksListQueryState,
  isSalePage: boolean,
): WorkSortKey {
  if (isSalePage && !query.sort?.trim()) return SALE_DEFAULT_WORK_SORT;
  return parseWorkSortParam(query.sort);
}

function hasUnsupportedDbFilters(query: WorksListQueryState): boolean {
  // テキスト検索・ジャンル複数は DB JSON 絞り込みが重いためカタログへ
  return (
    Boolean(query.q?.trim()) ||
    Boolean(query.genre?.trim()) ||
    Boolean(query.genres?.trim())
  );
}

async function rowsToLiveItems(rows: WorkMasterRow[]): Promise<DmmItem[]> {
  const items = rows.map(workMasterRowToDmmItem);
  const cids = items.map((item) => item.content_id);
  let liveMap = new Map<string, WorkLiveStatusRow>();
  try {
    liveMap = await measureAsync("supabase.live_status.by_cids", () =>
      supabaseFetchLiveStatusByCids(cids),
    );
    incrPerfCounter("supabase.queries");
  } catch (error) {
    console.warn("[public-list] live status merge skipped", error);
  }
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

  const today = getTokyoDateString();
  const map = new Map<string, WorkMasterRow>();
  for (const row of parseWorkRows(data)) {
    if (row.image_status === "now_printing" || row.image_status === "fetch_failed") {
      continue;
    }
    if (!isReleasedOnOrBefore(row.release_date, today)) {
      continue;
    }
    map.set(row.cid, row);
  }
  return cids.map((cid) => map.get(cid)).filter((row): row is WorkMasterRow => Boolean(row));
}

async function detectPriceAmountColumn(): Promise<boolean> {
  if (priceAmountColumnAvailable != null) return priceAmountColumnAvailable;
  const client = getSupabaseServiceClient();
  if (!client) {
    priceAmountColumnAvailable = false;
    return false;
  }
  const { error } = await client
    .from(LIVE_TABLE)
    .select("price_amount")
    .limit(1);
  priceAmountColumnAvailable = !error;
  return priceAmountColumnAvailable;
}

async function detectDurationMinutesColumn(): Promise<boolean> {
  if (durationMinutesColumnAvailable != null) {
    return durationMinutesColumnAvailable;
  }
  const client = getSupabaseServiceClient();
  if (!client) {
    durationMinutesColumnAvailable = false;
    return false;
  }
  const { error } = await client
    .from(WORKS_TABLE)
    .select("duration_minutes")
    .limit(1);
  durationMinutesColumnAvailable = !error;
  return durationMinutesColumnAvailable;
}

async function tryFetchViaRpc(options: {
  sort: WorkSortKey;
  page: number;
  pageSize: number;
  saleOnly?: boolean;
  seed?: string;
}): Promise<{ items: DmmItem[]; totalItems: number } | null> {
  // マイグレーション未適用環境では RPC を試さない（ビルドログ汚染・余分な往復を避ける）
  if (listRpcAvailable === false) return null;
  if (listRpcAvailable == null) {
    // price_amount 未適用なら RPC も未適用とみなす
    const hasPriceAmount = await detectPriceAmountColumn();
    if (!hasPriceAmount) {
      listRpcAvailable = false;
      return null;
    }
  }
  const client = getSupabaseServiceClient();
  if (!client) return null;

  const page = Math.max(1, options.page);
  const pageSize = options.pageSize;
  const offset = (page - 1) * pageSize;

  const { data, error } = await client.rpc("fetch_public_works_list_page", {
    p_sort: options.sort,
    p_offset: offset,
    p_limit: pageSize,
    p_sale_only: Boolean(options.saleOnly),
    p_seed: options.seed ?? getTokyoDateString(),
  });

  if (error) {
    listRpcAvailable = false;
    console.warn("[public-list] rpc unavailable", error.message);
    return null;
  }
  listRpcAvailable = true;

  const rows = (data ?? []) as Array<{ cid?: string; total_count?: number }>;
  const cids = rows
    .map((row) => normalizeCatalogContentId(String(row.cid ?? "")))
    .filter((cid): cid is string => Boolean(cid));
  const totalItems =
    rows.length > 0 ? Number(rows[0]?.total_count ?? cids.length) : 0;
  const workRows = await fetchWorksByCidsOrdered(cids);
  const items = await rowsToLiveItems(workRows);
  return { items, totalItems };
}

function applyMakerFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  makers: string[],
): T {
  if (makers.length === 1) {
    return query.eq("maker", makers[0]!);
  }
  return query;
}

async function fetchPublicWorksPageLegacy(options: {
  sort: WorkSortKey;
  page: number;
  pageSize: number;
  saleOnly?: boolean;
  seed?: string;
  makers?: string[];
  price?: string;
  date?: string;
}): Promise<{ items: DmmItem[]; totalItems: number }> {
  const pageSize = options.pageSize;
  const page = Math.max(1, options.page);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const client = getSupabaseServiceClient();
  if (!client) return { items: [], totalItems: 0 };

  const today = getTokyoDateString();
  // PostgREST の or/filter に空白を入れるとパースが壊れるため、翌日未満で発売日を切る
  const tomorrow = (() => {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d! + 1));
    return dt.toISOString().slice(0, 10);
  })();
  const releaseOnOrBeforeFilter = `release_date.is.null,release_date.lt.${tomorrow}`;
  const hasPriceAmount = await detectPriceAmountColumn();
  const hasDurationMinutes = await detectDurationMinutesColumn();
  const makers = options.makers ?? [];
  const singleMaker = makers.length === 1 ? makers[0] : undefined;

  const liveSorts = new Set<WorkSortKey>([
    "popular",
    "price-asc",
    "price-desc",
    "discount",
    "rating",
  ]);

  if (options.saleOnly || liveSorts.has(options.sort)) {
    let liveQuery = client
      .from(LIVE_TABLE)
      .select("cid", { count: "exact" })
      .eq("is_available", true);

    if (options.saleOnly || options.sort === "discount") {
      liveQuery = liveQuery
        .eq("is_sale", true)
        .gt("discount_rate", 0)
        .or(`sale_end_at.is.null,sale_end_at.gt.${new Date().toISOString()}`);
    }

    if (options.sort === "popular") {
      // 0 は除外、null（未取得）は末尾
      liveQuery = liveQuery
        .or("popularity_rank.gt.0,popularity_rank.is.null")
        .order("popularity_rank", { ascending: true, nullsFirst: false })
        .order("review_count", { ascending: false, nullsFirst: false })
        .order("rating", { ascending: false, nullsFirst: false });
    } else if (options.sort === "discount") {
      const priceCol = hasPriceAmount
        ? "price_amount"
        : PRICE_SORT_FALLBACK_COLUMN;
      liveQuery = liveQuery
        .order("discount_rate", { ascending: false, nullsFirst: false })
        .order(priceCol, {
          ascending: true,
          nullsFirst: false,
        });
    } else if (options.sort === "price-asc" || options.sort === "price-desc") {
      const priceCol = hasPriceAmount
        ? "price_amount"
        : PRICE_SORT_FALLBACK_COLUMN;
      liveQuery = liveQuery.gt(priceCol, 0);
      liveQuery = liveQuery
        .order(priceCol, {
          ascending: options.sort === "price-asc",
          nullsFirst: false,
        })
        .order("popularity_rank", { ascending: true, nullsFirst: false });
    } else if (options.sort === "rating") {
      liveQuery = liveQuery
        .gt("review_count", 0)
        .not("rating", "is", null)
        .order("rating", { ascending: false, nullsFirst: false })
        .order("review_count", { ascending: false, nullsFirst: false })
        .order("popularity_rank", { ascending: true, nullsFirst: false });
    } else {
      liveQuery = liveQuery.order("updated_at", { ascending: false });
    }

    // 発売前除外は works 側で行うため、多めに取得して穴埋め
    const overscan = Math.min(200, pageSize * 5);
    const fetchFrom = Math.max(0, from);
    const fetchTo = fetchFrom + overscan - 1;
    const { data, count, error } = await liveQuery.range(fetchFrom, fetchTo);
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

    let workQuery = client
      .from(WORKS_TABLE)
      .select(LIST_SELECT)
      .in("cid", cids)
      .eq("published", true)
      .or("image_status.eq.ok,image_status.is.null")
      .or(releaseOnOrBeforeFilter);

    if (singleMaker) {
      workQuery = workQuery.eq("maker", singleMaker);
    }

    const { data: workData, error: workError } = await workQuery;
    incrPerfCounter("supabase.queries");
    if (workError) {
      console.warn("[public-list] works filter failed", workError.message);
      return { items: [], totalItems: 0 };
    }

    const workMap = new Map(
      parseWorkRows(workData).map((row) => [row.cid, row] as const),
    );
    const orderedRows = cids
      .map((cid) => workMap.get(cid))
      .filter((row): row is WorkMasterRow => Boolean(row))
      .slice(0, pageSize);

    const items = await rowsToLiveItems(orderedRows);
    // count は live 側概算（発売前除外分は多少ずれる）
    return { items, totalItems: count ?? items.length };
  }

  // works テーブル起点: 新着 / 追加 / 再生時間 / ランダム
  let worksQuery = client
    .from(WORKS_TABLE)
    .select(LIST_SELECT, { count: "exact" })
    .eq("published", true)
    .or("image_status.eq.ok,image_status.is.null")
    .or(releaseOnOrBeforeFilter);

  if (singleMaker) {
    worksQuery = applyMakerFilter(worksQuery, makers);
  }

  if (options.sort === "release-new") {
    worksQuery = worksQuery
      .order("release_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  } else if (options.sort === "added") {
    worksQuery = worksQuery.order("created_at", { ascending: false });
  } else if (options.sort === "duration-desc") {
    if (hasDurationMinutes) {
      worksQuery = worksQuery
        .gt("duration_minutes", 0)
        .order("duration_minutes", { ascending: false, nullsFirst: false });
    } else {
      // テキスト duration はゼロ埋め済みを前提に DESC
      worksQuery = worksQuery
        .not("duration", "is", null)
        .neq("duration", "0")
        .order("duration", { ascending: false, nullsFirst: false });
    }
  } else if (options.sort === "random") {
    // シード付きオフセット（ページ移動で重複しにくい）
    const { count: totalCount } = await client
      .from(WORKS_TABLE)
      .select("cid", { count: "exact", head: true })
      .eq("published", true)
      .or("image_status.eq.ok,image_status.is.null")
      .or(releaseOnOrBeforeFilter);
    incrPerfCounter("supabase.queries");
    const total = totalCount ?? 0;
    if (total === 0) return { items: [], totalItems: 0 };
    const seed = options.seed ?? getTokyoDateString();
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const base = hash >>> 0;
    const start = (base + (page - 1) * pageSize) % Math.max(1, total);
    const end = Math.min(start + pageSize - 1, total - 1);
    const { data, error } = await worksQuery
      .order("cid", { ascending: true })
      .range(start, end);
    incrPerfCounter("supabase.queries");
    if (error) {
      console.warn("[public-list] random page failed", error.message);
      return { items: [], totalItems: 0 };
    }
    let rows = parseWorkRows(data);
    if (rows.length < pageSize && start > 0) {
      const need = pageSize - rows.length;
      const { data: wrapData } = await client
        .from(WORKS_TABLE)
        .select(LIST_SELECT)
        .eq("published", true)
        .or("image_status.eq.ok,image_status.is.null")
        .or(releaseOnOrBeforeFilter)
        .order("cid", { ascending: true })
        .range(0, need - 1);
      incrPerfCounter("supabase.queries");
      rows = [...rows, ...parseWorkRows(wrapData)];
    }
    const items = await rowsToLiveItems(rows.slice(0, pageSize));
    return { items, totalItems: total };
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
}

/** 新着・人気・セールなど単純ソートの1ページ分（最大 pageSize 件） */
export async function fetchPublicWorksPage(options: {
  sort: WorkSortKey;
  page: number;
  pageSize?: number;
  saleOnly?: boolean;
  seed?: string;
  makers?: string[];
  price?: string;
  date?: string;
}): Promise<{ items: DmmItem[]; totalItems: number }> {
  const pageSize = options.pageSize ?? WORKS_LIST_PAGE_SIZE;
  const page = Math.max(1, options.page);

  return measureAsync(`public.works.page.${options.sort}`, async () => {
    const makers = options.makers ?? [];
    const canUseRpc =
      makers.length === 0 &&
      (!options.price || options.price === "all") &&
      (!options.date || options.date === "all");

    if (canUseRpc) {
      const viaRpc = await tryFetchViaRpc({
        sort: options.sort,
        page,
        pageSize,
        saleOnly: options.saleOnly,
        seed: options.seed,
      });
      if (viaRpc) return viaRpc;
    }

    return fetchPublicWorksPageLegacy({
      ...options,
      page,
      pageSize,
    });
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
      "public-works-slice-v3",
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

function buildListCacheKey(parts: {
  sort: WorkSortKey;
  isSalePage: boolean;
  page: number;
  seed?: string;
  genres: string[];
  makers: string[];
  price: string;
  date: string;
}): string {
  return [
    "works-list-v3",
    parts.sort,
    parts.isSalePage ? "sale" : "all",
    String(parts.page),
    String(WORKS_LIST_PAGE_SIZE),
    parts.seed ?? "-",
    parts.genres.join(",") || "-",
    parts.makers.join(",") || "-",
    parts.price || "all",
    parts.date || "all",
  ].join(":");
}

/**
 * 公開作品一覧。ソート・公開条件・ページングは DB 側で実行し 1 ページ分だけ取得。
 * テキスト検索・ジャンル絞り込みのみカタログフォールバック。
 */
export async function tryGetWorksListPageDataFromDb(
  query: WorksListQueryState,
): Promise<PublicWorksListPageData | null> {
  if (!isPublicWorksDbQueryAvailable()) return null;
  if (hasUnsupportedDbFilters(query)) return null;

  const isSalePage = isWorksListSaleQuery(query);
  const sort = resolveSort(query, isSalePage);
  const page = Math.max(1, Number(query.page) || 1);
  const makers = getAppliedMakers(query);
  const genres = getAppliedGenres(query);
  const price = (query.price ?? "all").trim() || "all";
  const date = (query.date ?? "all").trim() || "all";

  // 価格帯・発売時期フィルターは現状カタログ側（ライブ結合後の数値判定）
  if (price !== "all" || date !== "all" || makers.length > 1) {
    return null;
  }

  // views 系のみ未対応
  if (sort === "today-views" || sort === "total-views") {
    return null;
  }

  const seed =
    sort === "random"
      ? (query.seed?.trim() || getTokyoDateString())
      : undefined;

  const cacheKey = buildListCacheKey({
    sort,
    isSalePage,
    page,
    seed,
    genres,
    makers,
    price,
    date,
  });

  const sortOptions: WorkSortOption[] = isSalePage
    ? [
        { key: "discount", label: WORK_SORT_LABELS.discount },
        ...DEFAULT_CATALOG_SORT_OPTIONS.filter((opt) => opt.key !== "discount"),
      ]
    : DEFAULT_CATALOG_SORT_OPTIONS;

  const cached = unstable_cache(
    async () => {
      const { items, totalItems } = await fetchPublicWorksPage({
        sort,
        page,
        pageSize: WORKS_LIST_PAGE_SIZE,
        saleOnly: isSalePage,
        seed,
        makers,
        price,
        date,
      });
      if (items.length === 0 && totalItems === 0) {
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
        sortOptions,
      };
    },
    [cacheKey],
    {
      revalidate: isSalePage
        ? 300
        : sort === "release-new"
          ? 600
          : sort === "random"
            ? 120
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
