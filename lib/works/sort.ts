import type { DmmItem } from "@/lib/dmm/types";
import { getSalePriceInfo, parseComparablePrice } from "@/lib/dmm/sale-price";
import {
  DEFAULT_WORK_SORT,
  WORK_SORT_LABELS,
  type WorkSortKey,
  type WorkSortOption,
} from "@/lib/works/sort-options";

export type {
  WorkSortKey,
  WorkSortOption,
} from "@/lib/works/sort-options";
export {
  DEFAULT_CATALOG_SORT_OPTIONS,
  DEFAULT_WORK_SORT,
  HOME_WORK_SORT_KEYS,
  SALE_DEFAULT_WORK_SORT,
  WORK_SORT_LABELS,
} from "@/lib/works/sort-options";

/** @deprecated use release-new */
export type LegacyWorkSortKey = "new" | "release-desc" | "discount-desc";

export type SortWorksOptions = {
  /** index 0 = 最近 catalog へ追加。added 順のフォールバック用 */
  catalogOrder?: Map<string, number>;
  /** random の再現用シード */
  randomSeed?: string;
};

type DmmItemWithViews = DmmItem & {
  todayViewCount?: number;
  totalViewCount?: number;
};

const NULLS_LAST = 1;
const NULLS_FIRST = 0;

export function buildCatalogOrderMap(items: DmmItem[]): Map<string, number> {
  return new Map(items.map((item, index) => [item.content_id, index]));
}

export function parseReleaseTimestamp(item: DmmItem): number | null {
  const raw = item.date?.trim();
  if (!raw) return null;
  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function parseAddedTimestamp(item: DmmItem): number | null {
  const raw = item.addedAt?.trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCatalogAddedIndex(
  item: DmmItem,
  catalogOrder?: Map<string, number>,
): number {
  return catalogOrder?.get(item.content_id) ?? Number.MAX_SAFE_INTEGER;
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: "asc" | "desc",
  emptyLast = true,
): number {
  const aValid = typeof a === "number" && Number.isFinite(a);
  const bValid = typeof b === "number" && Number.isFinite(b);
  if (aValid !== bValid) {
    if (!aValid) return emptyLast ? NULLS_LAST : NULLS_FIRST;
    return emptyLast ? -NULLS_LAST : NULLS_FIRST;
  }
  if (!aValid || !bValid) return 0;
  return direction === "asc" ? a - b : b - a;
}

function getFanzaRank(item: DmmItem): number | null {
  const rank = item.sourcePopularityRank;
  if (typeof rank !== "number" || !Number.isFinite(rank) || rank <= 0) {
    return null;
  }
  return rank;
}

function getItemPriceAmount(item: DmmItem): number | null {
  return parseComparablePrice(item.prices?.price);
}

function getReviewCount(item: DmmItem): number | null {
  const count = item.review?.count;
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) {
    return null;
  }
  return count;
}

function getRating(item: DmmItem): number | null {
  const raw = item.review?.average;
  if (raw == null || raw === "") return null;
  const parsed = Number.parseFloat(String(raw));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getDiscountRate(item: DmmItem): number | null {
  const fromSale = getSalePriceInfo(item)?.discountRate;
  if (typeof fromSale === "number" && fromSale > 0) return fromSale;
  const raw = item.discountRate;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  return null;
}

export function getItemDurationMinutes(item: DmmItem): number | null {
  if (!item.volume?.trim()) return null;
  const parsed = parseInt(item.volume.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getTodayViewCount(item: DmmItem): number | null {
  const value = (item as DmmItemWithViews).todayViewCount;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getTotalViewCount(item: DmmItem): number | null {
  const value = (item as DmmItemWithViews).totalViewCount;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const shuffled = [...items];
  let state = hashSeed(seed) || 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(next() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function comparePopularSort(a: DmmItem, b: DmmItem): number {
  const rankDiff = compareNullableNumber(
    getFanzaRank(a),
    getFanzaRank(b),
    "asc",
    true,
  );
  if (rankDiff !== 0) return rankDiff;

  const reviewDiff = compareNullableNumber(
    getReviewCount(a),
    getReviewCount(b),
    "desc",
    true,
  );
  if (reviewDiff !== 0) return reviewDiff;

  const ratingDiff = compareNullableNumber(getRating(a), getRating(b), "desc", true);
  if (ratingDiff !== 0) return ratingDiff;

  return compareNullableNumber(
    parseReleaseTimestamp(a),
    parseReleaseTimestamp(b),
    "desc",
    true,
  );
}

function comparePriceSort(a: DmmItem, b: DmmItem, direction: "asc" | "desc"): number {
  const priceDiff = compareNullableNumber(
    getItemPriceAmount(a),
    getItemPriceAmount(b),
    direction,
    true,
  );
  if (priceDiff !== 0) return priceDiff;

  const rankDiff = compareNullableNumber(
    getFanzaRank(a),
    getFanzaRank(b),
    "asc",
    true,
  );
  if (rankDiff !== 0) return rankDiff;

  return compareNullableNumber(
    parseReleaseTimestamp(a),
    parseReleaseTimestamp(b),
    "desc",
    true,
  );
}

function compareRatingSort(a: DmmItem, b: DmmItem): number {
  const aReviews = getReviewCount(a);
  const bReviews = getReviewCount(b);
  const aRating = getRating(a);
  const bRating = getRating(b);
  const aValid = aReviews != null && aRating != null;
  const bValid = bReviews != null && bRating != null;
  if (aValid !== bValid) return aValid ? -1 : 1;

  const ratingDiff = compareNullableNumber(aRating, bRating, "desc", true);
  if (ratingDiff !== 0) return ratingDiff;

  const reviewDiff = compareNullableNumber(aReviews, bReviews, "desc", true);
  if (reviewDiff !== 0) return reviewDiff;

  return compareNullableNumber(getFanzaRank(a), getFanzaRank(b), "asc", true);
}

function compareDiscountSort(a: DmmItem, b: DmmItem): number {
  const rateDiff = compareNullableNumber(
    getDiscountRate(a),
    getDiscountRate(b),
    "desc",
    true,
  );
  if (rateDiff !== 0) return rateDiff;
  return compareNullableNumber(
    getItemPriceAmount(a),
    getItemPriceAmount(b),
    "asc",
    true,
  );
}

/** URL / UI の sort 値を正規化。不正値は人気順へフォールバック */
export function parseWorkSortParam(value?: string | null): WorkSortKey {
  switch (value) {
    case "added":
    case "added-desc":
      return "added";
    case "new":
    case "latest":
    case "release-new":
    case "release-desc":
    case "release_desc":
      return "release-new";
    case "price-desc":
    case "price_desc":
      return "price-desc";
    case "price-asc":
    case "price_asc":
      return "price-asc";
    case "rating":
    case "rating-desc":
    case "rating_desc":
      return "rating";
    case "discount":
    case "discount-desc":
    case "discount_desc":
      return "discount";
    case "today-views":
      return "today-views";
    case "total-views":
      return "total-views";
    case "duration-desc":
    case "duration_desc":
      return "duration-desc";
    case "random":
      return "random";
    case "rank":
    case "popular":
      return "popular";
    default:
      return DEFAULT_WORK_SORT;
  }
}

/** URL に書き出す正規 sort 値 */
export function toWorkSortUrlValue(sort: WorkSortKey): string | undefined {
  if (sort === DEFAULT_WORK_SORT) return undefined;
  return sort;
}

export function getWorksSortOptions(
  items: DmmItem[],
  options: { includeDiscountSort?: boolean } = {},
): WorkSortOption[] {
  const keys: WorkSortKey[] = options.includeDiscountSort
    ? [
        "discount",
        "popular",
        "added",
        "release-new",
        "price-asc",
        "price-desc",
        "rating",
      ]
    : [
        "popular",
        "added",
        "release-new",
        "price-asc",
        "price-desc",
        "rating",
      ];

  if (items.some((item) => getTodayViewCount(item) !== null)) {
    keys.push("today-views");
  }
  if (items.some((item) => getTotalViewCount(item) !== null)) {
    keys.push("total-views");
  }

  keys.push("duration-desc", "random");

  const seen = new Set<WorkSortKey>();
  return keys
    .filter((key) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((key) => ({ key, label: WORK_SORT_LABELS[key] }));
}

/**
 * カタログフォールバック用のメモリソート。
 * /works の通常パスでは使わず、DB 側 order + range を優先する。
 */
export function sortWorks(
  items: DmmItem[],
  sort: WorkSortKey = DEFAULT_WORK_SORT,
  options: SortWorksOptions = {},
): DmmItem[] {
  const sorted = [...items];
  const catalogOrder = options.catalogOrder;

  switch (sort) {
    case "popular":
      return sorted.sort(comparePopularSort);
    case "added":
      return sorted.sort((a, b) => {
        const addedDiff = compareNullableNumber(
          parseAddedTimestamp(a),
          parseAddedTimestamp(b),
          "desc",
          true,
        );
        if (addedDiff !== 0) return addedDiff;
        const indexA = getCatalogAddedIndex(a, catalogOrder);
        const indexB = getCatalogAddedIndex(b, catalogOrder);
        if (indexA !== indexB) return indexA - indexB;
        return compareNullableNumber(
          parseReleaseTimestamp(a),
          parseReleaseTimestamp(b),
          "desc",
          true,
        );
      });
    case "release-new":
      return sorted.sort((a, b) =>
        compareNullableNumber(
          parseReleaseTimestamp(a),
          parseReleaseTimestamp(b),
          "desc",
          true,
        ),
      );
    case "price-desc":
      return sorted.sort((a, b) => comparePriceSort(a, b, "desc"));
    case "price-asc":
      return sorted.sort((a, b) => comparePriceSort(a, b, "asc"));
    case "rating":
      return sorted.sort(compareRatingSort);
    case "discount":
      return sorted.sort(compareDiscountSort);
    case "today-views":
      return sorted.sort((a, b) =>
        compareNullableNumber(
          getTodayViewCount(a),
          getTodayViewCount(b),
          "desc",
          true,
        ),
      );
    case "total-views":
      return sorted.sort((a, b) =>
        compareNullableNumber(
          getTotalViewCount(a),
          getTotalViewCount(b),
          "desc",
          true,
        ),
      );
    case "duration-desc":
      return sorted.sort((a, b) =>
        compareNullableNumber(
          getItemDurationMinutes(a),
          getItemDurationMinutes(b),
          "desc",
          true,
        ),
      );
    case "random":
      return seededShuffle(
        sorted,
        options.randomSeed ?? `works-random-${new Date().toISOString().slice(0, 10)}`,
      );
    default:
      return sorted.sort(comparePopularSort);
  }
}

export function buildWorksSortHref(
  basePath: string,
  sort: WorkSortKey,
  query: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (key === "page" || key === "sort") continue;
    if (value) params.set(key, value);
  }

  const sortValue = toWorkSortUrlValue(sort);
  if (sortValue) params.set("sort", sortValue);

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function getWorksCanonicalPath(
  sort: WorkSortKey,
  basePath = "/works",
): string {
  return sort === "random" ? basePath : basePath;
}

export function getWorksSortPageTitle(sort: WorkSortKey): string | null {
  switch (sort) {
    case "added":
      return "追加順 作品一覧";
    case "release-new":
      return "発売日が新しい順 作品一覧";
    case "price-desc":
      return "価格が高い順 作品一覧";
    case "price-asc":
      return "価格が安い順 作品一覧";
    case "rating":
      return "評価順 作品一覧";
    case "discount":
      return "セール率順 セール作品一覧";
    case "today-views":
      return "本日の再生数順 作品一覧";
    case "total-views":
      return "総再生数順 作品一覧";
    case "duration-desc":
      return "再生時間が長い順 作品一覧";
    case "random":
      return "ランダム作品一覧";
    case "popular":
      return null;
  }
}

/** 東京日付（YYYY-MM-DD）。発売前除外・random seed 用 */
export function getTokyoDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isReleasedOnOrBefore(
  releaseDate: string | null | undefined,
  today = getTokyoDateString(),
): boolean {
  if (!releaseDate?.trim()) return true;
  return releaseDate.trim().slice(0, 10) <= today;
}
