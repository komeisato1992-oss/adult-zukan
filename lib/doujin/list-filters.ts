import type { DoujinWork } from "@/lib/doujin/types";
import {
  DOUJIN_PRODUCT_FORMATS,
  DOUJIN_PRODUCT_FORMAT_LABELS,
  isDoujinProductFormat,
  parseDoujinProductFormatParam,
  type DoujinProductFormat,
} from "@/lib/doujin/product-format";

export type DoujinPriceFilterKey =
  | "all"
  | "under500"
  | "501-1000"
  | "1001-2000"
  | "2001-3000"
  | "over3000";

export type DoujinReleaseFilterKey =
  | "all"
  | "7d"
  | "30d"
  | "3m"
  | "6m"
  | "1y";

export type DoujinWorkSortKey =
  | "popular"
  | "new"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "reviews"
  | "discount";

export type DoujinFilterOption = {
  label: string;
  value: string;
  count?: number;
};

export type DoujinWorksListQueryState = {
  /** @deprecated genres を使用 */
  genre?: string;
  genres?: string;
  /** @deprecated circles を使用 */
  circle?: string;
  circles?: string;
  /** 作品形式（単一） comic / video 等 */
  format?: string;
  price?: string;
  release?: string;
  year?: string;
  sort?: string;
  page?: string;
};

export type DoujinWorksFilterDraft = {
  genres: string[];
  circles: string[];
  format: DoujinProductFormat | "";
  price: DoujinPriceFilterKey;
  release: DoujinReleaseFilterKey;
  year: string;
};

export const DOUJIN_PRICE_FILTER_OPTIONS: Array<{
  key: DoujinPriceFilterKey;
  label: string;
}> = [
  { key: "all", label: "すべて" },
  { key: "under500", label: "500円以下" },
  { key: "501-1000", label: "501円〜1,000円" },
  { key: "1001-2000", label: "1,001円〜2,000円" },
  { key: "2001-3000", label: "2,001円〜3,000円" },
  { key: "over3000", label: "3,001円以上" },
];

export const DOUJIN_RELEASE_FILTER_OPTIONS: Array<{
  key: DoujinReleaseFilterKey;
  label: string;
}> = [
  { key: "all", label: "すべて" },
  { key: "7d", label: "過去7日" },
  { key: "30d", label: "過去30日" },
  { key: "3m", label: "過去3か月" },
  { key: "6m", label: "過去6か月" },
  { key: "1y", label: "過去1年" },
];

export const DOUJIN_WORK_SORT_OPTIONS: Array<{
  key: DoujinWorkSortKey;
  label: string;
}> = [
  { key: "popular", label: "人気順" },
  { key: "new", label: "新着順" },
  { key: "price_asc", label: "価格が安い順" },
  { key: "price_desc", label: "価格が高い順" },
  { key: "rating", label: "評価順" },
  { key: "reviews", label: "レビュー数順" },
  { key: "discount", label: "セール率順" },
];

export const DOUJIN_WORKS_DEFAULT_PER_PAGE = 20;
export const DOUJIN_WORKS_DEFAULT_SORT: DoujinWorkSortKey = "popular";
export const DOUJIN_CIRCLE_PANEL_LIMIT = 100;

export const DOUJIN_FORMAT_FILTER_OPTIONS: Array<{
  key: DoujinProductFormat;
  label: string;
}> = DOUJIN_PRODUCT_FORMATS.map((key) => ({
  key,
  label: DOUJIN_PRODUCT_FORMAT_LABELS[key],
}));

function splitCsvParam(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return [
    ...new Set(value.split(",").map((part) => part.trim()).filter(Boolean)),
  ];
}

export function getAppliedDoujinGenres(
  query: DoujinWorksListQueryState,
): string[] {
  const fromPlural = splitCsvParam(query.genres);
  if (fromPlural.length > 0) return fromPlural;
  const legacy = query.genre?.trim();
  return legacy ? [legacy] : [];
}

export function getAppliedDoujinCircles(
  query: DoujinWorksListQueryState,
): string[] {
  const fromPlural = splitCsvParam(query.circles);
  if (fromPlural.length > 0) return fromPlural;
  const legacy = query.circle?.trim();
  return legacy ? [legacy] : [];
}

export function parseDoujinWorkSortParam(
  value?: string | null,
): DoujinWorkSortKey {
  const raw = value?.trim();
  if (!raw) return DOUJIN_WORKS_DEFAULT_SORT;
  const normalized = raw.replace(/-/g, "_");
  if (DOUJIN_WORK_SORT_OPTIONS.some((option) => option.key === normalized)) {
    return normalized as DoujinWorkSortKey;
  }
  if (raw === "price-asc") return "price_asc";
  if (raw === "price-desc") return "price_desc";
  return DOUJIN_WORKS_DEFAULT_SORT;
}

export function parseDoujinPriceFilter(
  value?: string | null,
): DoujinPriceFilterKey {
  const raw = value?.trim();
  if (DOUJIN_PRICE_FILTER_OPTIONS.some((option) => option.key === raw)) {
    return raw as DoujinPriceFilterKey;
  }
  return "all";
}

export function parseDoujinReleaseFilter(
  value?: string | null,
): DoujinReleaseFilterKey {
  const raw = value?.trim();
  if (DOUJIN_RELEASE_FILTER_OPTIONS.some((option) => option.key === raw)) {
    return raw as DoujinReleaseFilterKey;
  }
  return "all";
}

export function parseDoujinWorksListQuery(
  params: Record<string, string | string[] | undefined>,
): DoujinWorksListQueryState {
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return {
    genre: pick("genre")?.trim() || undefined,
    genres: pick("genres")?.trim() || undefined,
    circle: pick("circle")?.trim() || undefined,
    circles: pick("circles")?.trim() || undefined,
    format: pick("format")?.trim() || undefined,
    price: pick("price")?.trim() || undefined,
    release: pick("release")?.trim() || undefined,
    year: pick("year")?.trim() || undefined,
    sort: pick("sort")?.trim() || undefined,
    page: pick("page")?.trim() || undefined,
  };
}

export function buildDoujinWorksFilterDraftFromQuery(
  query: DoujinWorksListQueryState,
): DoujinWorksFilterDraft {
  const format = parseDoujinProductFormatParam(query.format);
  return {
    genres: getAppliedDoujinGenres(query),
    circles: getAppliedDoujinCircles(query),
    format: format ?? "",
    price: parseDoujinPriceFilter(query.price),
    release: parseDoujinReleaseFilter(query.release),
    year: query.year?.trim() || "",
  };
}

export function applyDoujinWorksFilterDraftToQuery(
  query: DoujinWorksListQueryState,
  draft: DoujinWorksFilterDraft,
): DoujinWorksListQueryState {
  return {
    ...query,
    genre: undefined,
    genres: draft.genres.length > 0 ? draft.genres.join(",") : undefined,
    circle: undefined,
    circles: draft.circles.length > 0 ? draft.circles.join(",") : undefined,
    format: draft.format || undefined,
    price: draft.price === "all" ? undefined : draft.price,
    release: draft.release === "all" ? undefined : draft.release,
    year: draft.year || undefined,
    page: "1",
  };
}

export function buildDoujinWorksQueryString(
  state: DoujinWorksListQueryState,
): string {
  const params = new URLSearchParams();
  const genres = getAppliedDoujinGenres(state);
  const circles = getAppliedDoujinCircles(state);
  if (genres.length === 1) params.set("genre", genres[0]);
  else if (genres.length > 1) params.set("genres", genres.join(","));
  if (circles.length === 1) params.set("circle", circles[0]);
  else if (circles.length > 1) params.set("circles", circles.join(","));
  const format = parseDoujinProductFormatParam(state.format);
  if (format) params.set("format", format);
  const price = parseDoujinPriceFilter(state.price);
  if (price !== "all") params.set("price", price);
  const release = parseDoujinReleaseFilter(state.release);
  if (release !== "all") params.set("release", release);
  if (state.year) params.set("year", state.year);
  const sort = parseDoujinWorkSortParam(state.sort);
  if (sort !== DOUJIN_WORKS_DEFAULT_SORT) params.set("sort", sort);
  const page = Number(state.page);
  if (Number.isFinite(page) && page > 1) params.set("page", String(page));
  return params.toString();
}

function parseReleaseDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesPrice(
  work: DoujinWork,
  price: DoujinPriceFilterKey,
): boolean {
  if (price === "all") return true;
  if (work.price == null) return false;
  const p = work.price;
  switch (price) {
    case "under500":
      return p <= 500;
    case "501-1000":
      return p >= 501 && p <= 1000;
    case "1001-2000":
      return p >= 1001 && p <= 2000;
    case "2001-3000":
      return p >= 2001 && p <= 3000;
    case "over3000":
      return p >= 3001;
    default:
      return true;
  }
}

function matchesRelease(
  work: DoujinWork,
  release: DoujinReleaseFilterKey,
  now = new Date(),
): boolean {
  if (release === "all") return true;
  const date = parseReleaseDate(work.releaseDate);
  if (!date) return false;
  const ms = now.getTime() - date.getTime();
  if (ms < 0) return true;
  const day = 24 * 60 * 60 * 1000;
  switch (release) {
    case "7d":
      return ms <= 7 * day;
    case "30d":
      return ms <= 30 * day;
    case "3m":
      return ms <= 90 * day;
    case "6m":
      return ms <= 180 * day;
    case "1y":
      return ms <= 365 * day;
    default:
      return true;
  }
}

export function filterDoujinWorksByQuery(
  works: DoujinWork[],
  query: DoujinWorksListQueryState,
): DoujinWork[] {
  const draft = buildDoujinWorksFilterDraftFromQuery(query);
  return works.filter((work) => {
    if (draft.genres.length > 0) {
      const ids = work.genreIds ?? [];
      if (!draft.genres.every((genreId) => ids.includes(genreId))) {
        return false;
      }
    }
    if (draft.circles.length > 0) {
      const circleIds = work.circleIds?.length
        ? work.circleIds
        : work.circleId
          ? [work.circleId]
          : [];
      if (!draft.circles.every((circleId) => circleIds.includes(circleId))) {
        return false;
      }
    }
    if (draft.format) {
      const format = isDoujinProductFormat(work.productFormatNormalized)
        ? work.productFormatNormalized
        : null;
      if (format !== draft.format) return false;
    }
    if (!matchesPrice(work, draft.price)) return false;
    if (draft.year) {
      const year = work.releaseDate?.slice(0, 4);
      if (year !== draft.year) return false;
    } else if (!matchesRelease(work, draft.release)) {
      return false;
    }
    return true;
  });
}

export function sortDoujinWorksList(
  works: DoujinWork[],
  sort: DoujinWorkSortKey,
): DoujinWork[] {
  const list = [...works];
  switch (sort) {
    case "popular":
      return list.sort((a, b) => {
        const rankA =
          a.currentPopularRank ??
          a.initialPopularRank ??
          Number.MAX_SAFE_INTEGER;
        const rankB =
          b.currentPopularRank ??
          b.initialPopularRank ??
          Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        const reviewDiff = (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
        if (reviewDiff !== 0) return reviewDiff;
        const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
        if (ratingDiff !== 0) return ratingDiff;
        return String(b.releaseDate ?? "").localeCompare(
          String(a.releaseDate ?? ""),
        );
      });
    case "price_asc":
      return list.sort(
        (a, b) =>
          (a.price ?? Number.MAX_SAFE_INTEGER) -
          (b.price ?? Number.MAX_SAFE_INTEGER),
      );
    case "price_desc":
      return list.sort(
        (a, b) =>
          (b.price ?? Number.MIN_SAFE_INTEGER) -
          (a.price ?? Number.MIN_SAFE_INTEGER),
      );
    case "rating":
      return list.sort((a, b) => {
        const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      });
    case "reviews":
      return list.sort((a, b) => {
        const reviewDiff = (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
        if (reviewDiff !== 0) return reviewDiff;
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
    case "discount":
      return list.sort((a, b) => {
        const discountDiff = (b.discountRate ?? 0) - (a.discountRate ?? 0);
        if (discountDiff !== 0) return discountDiff;
        return (
          (a.price ?? Number.MAX_SAFE_INTEGER) -
          (b.price ?? Number.MAX_SAFE_INTEGER)
        );
      });
    case "new":
    default:
      return list.sort((a, b) =>
        String(b.releaseDate ?? "").localeCompare(String(a.releaseDate ?? "")),
      );
  }
}
