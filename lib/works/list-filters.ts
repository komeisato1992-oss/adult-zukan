import {
  getDmmItemGenreNameList,
  getDmmItemMakerName,
} from "@/lib/dmm/display";
import {
  getCurrentPrice,
  getRegularPrice,
  isWorkOnSale,
  isWorksListSaleQuery,
} from "@/lib/dmm/sale-price";
import type { DmmItem } from "@/lib/dmm/types";
import { parseDmmPrice } from "@/lib/utils";

export type WorkPriceFilterKey =
  | "all"
  | "under-1000"
  | "1000-2999"
  | "3000-4999"
  | "5000-over";

export type WorkDateFilterKey =
  | "all"
  | "7d"
  | "30d"
  | "3m"
  | "6m"
  | "1y"
  | "today"
  | "this-week"
  | "this-month"
  | "this-year";

export type WorkFilterOption = {
  label: string;
  value: string;
  count?: number;
};

export const WORK_PRICE_FILTER_OPTIONS: Array<{
  key: WorkPriceFilterKey;
  label: string;
}> = [
  { key: "all", label: "すべて" },
  { key: "under-1000", label: "¥1,000未満" },
  { key: "1000-2999", label: "¥1,000〜¥2,999" },
  { key: "3000-4999", label: "¥3,000〜¥4,999" },
  { key: "5000-over", label: "¥5,000以上" },
];

export const WORK_DATE_FILTER_OPTIONS: Array<{
  key: WorkDateFilterKey;
  label: string;
}> = [
  { key: "all", label: "指定なし" },
  { key: "7d", label: "7日以内" },
  { key: "30d", label: "30日以内" },
  { key: "3m", label: "3か月以内" },
  { key: "6m", label: "6か月以内" },
  { key: "1y", label: "1年以内" },
];

export type WorksListQueryState = {
  q?: string;
  sale?: string;
  filter?: string;
  sort?: string;
  /** @deprecated genres を使用 */
  genre?: string;
  genres?: string;
  /** @deprecated makers を使用 */
  maker?: string;
  makers?: string;
  price?: string;
  date?: string;
  page?: string;
};

export type WorksFilterDraft = {
  genres: string[];
  makers: string[];
  price: WorkPriceFilterKey;
  date: WorkDateFilterKey;
};

function splitCsvParam(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

export function getAppliedGenres(query: WorksListQueryState): string[] {
  const fromPlural = splitCsvParam(query.genres);
  if (fromPlural.length > 0) return fromPlural;
  const legacy = query.genre?.trim();
  return legacy ? [legacy] : [];
}

export function getAppliedMakers(query: WorksListQueryState): string[] {
  const fromPlural = splitCsvParam(query.makers);
  if (fromPlural.length > 0) return fromPlural;
  const legacy = query.maker?.trim();
  return legacy ? [legacy] : [];
}

export function buildWorksFilterDraftFromQuery(
  query: WorksListQueryState,
): WorksFilterDraft {
  return {
    genres: getAppliedGenres(query),
    makers: getAppliedMakers(query),
    price: parsePriceFilter(query.price),
    date: parseDateFilter(query.date),
  };
}

export function applyWorksFilterDraftToQuery(
  query: WorksListQueryState,
  draft: WorksFilterDraft,
): WorksListQueryState {
  return {
    ...query,
    genre: undefined,
    genres:
      draft.genres.length > 0 ? draft.genres.join(",") : undefined,
    maker: undefined,
    makers:
      draft.makers.length > 0 ? draft.makers.join(",") : undefined,
    price: draft.price,
    date: draft.date,
  };
}

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;
  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function parsePriceFilter(value?: string): WorkPriceFilterKey {
  switch (value) {
    case "under-1000":
    case "1000-2999":
    case "3000-4999":
    case "5000-over":
      return value;
    default:
      return "all";
  }
}

function parseDateFilter(value?: string): WorkDateFilterKey {
  switch (value) {
    case "7d":
    case "30d":
    case "3m":
    case "6m":
    case "1y":
    case "today":
    case "this-week":
    case "this-month":
    case "this-year":
      return value;
    default:
      return "all";
  }
}

function matchesPriceFilter(item: DmmItem, filter: WorkPriceFilterKey): boolean {
  if (filter === "all") return true;
  const price = parseDmmPrice(item.prices?.price);
  if (price <= 0) return false;

  switch (filter) {
    case "under-1000":
      return price < 1000;
    case "1000-2999":
      return price >= 1000 && price <= 2999;
    case "3000-4999":
      return price >= 3000 && price <= 4999;
    case "5000-over":
      return price >= 5000;
    default:
      return true;
  }
}

function getDateCutoff(filter: WorkDateFilterKey): number | null {
  if (filter === "all") return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case "7d":
    case "today":
    case "this-week": {
      const cutoff = new Date(todayStart);
      cutoff.setDate(cutoff.getDate() - 7);
      return cutoff.getTime();
    }
    case "30d":
    case "this-month": {
      const cutoff = new Date(todayStart);
      cutoff.setDate(cutoff.getDate() - 30);
      return cutoff.getTime();
    }
    case "3m": {
      const cutoff = new Date(todayStart);
      cutoff.setMonth(cutoff.getMonth() - 3);
      return cutoff.getTime();
    }
    case "6m": {
      const cutoff = new Date(todayStart);
      cutoff.setMonth(cutoff.getMonth() - 6);
      return cutoff.getTime();
    }
    case "1y":
    case "this-year": {
      const cutoff = new Date(todayStart);
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      return cutoff.getTime();
    }
    default:
      return null;
  }
}

function matchesDateFilterWithBounds(
  item: DmmItem,
  filter: WorkDateFilterKey,
): boolean {
  if (filter === "all") return true;
  const cutoff = getDateCutoff(filter);
  if (cutoff == null) return true;

  const ts = parseReleaseTimestamp(item);
  if (ts <= 0) return false;
  return ts >= cutoff;
}

export type WorkFilterEntry = {
  item: DmmItem;
  haystack: string;
  genres: string[];
  maker: string;
  price: number;
  listPrice: number;
  releaseTs: number;
};

/** フィルター用の派生データを一括構築（一覧の再計算コストを下げる） */
export function buildWorkFilterEntries(items: DmmItem[]): WorkFilterEntry[] {
  return items.map((item) => {
    const actresses = item.actress ?? item.iteminfo?.actress ?? [];
    const actressText = actresses.map((actress) => actress.name).join(" ");
    const maker = getDmmItemMakerName(item) ?? "";

    return {
      item,
      haystack: `${item.title} ${item.content_id} ${maker} ${actressText}`.toLowerCase(),
      genres: getDmmItemGenreNameList(item),
      maker,
      price: getCurrentPrice(item) ?? 0,
      listPrice: getRegularPrice(item) ?? 0,
      releaseTs: parseReleaseTimestamp(item),
    };
  });
}

function matchesPriceFilterEntry(
  entry: WorkFilterEntry,
  filter: WorkPriceFilterKey,
): boolean {
  if (filter === "all") return true;
  if (entry.price <= 0) return false;

  switch (filter) {
    case "under-1000":
      return entry.price < 1000;
    case "1000-2999":
      return entry.price >= 1000 && entry.price <= 2999;
    case "3000-4999":
      return entry.price >= 3000 && entry.price <= 4999;
    case "5000-over":
      return entry.price >= 5000;
    default:
      return true;
  }
}

function matchesDateFilterEntry(
  entry: WorkFilterEntry,
  filter: WorkDateFilterKey,
): boolean {
  if (filter === "all") return true;
  const cutoff = getDateCutoff(filter);
  if (cutoff == null) return true;
  if (entry.releaseTs <= 0) return false;
  return entry.releaseTs >= cutoff;
}

export function filterWorkEntriesByQuery(
  entries: WorkFilterEntry[],
  query: WorksListQueryState,
): DmmItem[] {
  const keyword = query.q?.trim().toLowerCase();
  const genres = getAppliedGenres(query);
  const makers = getAppliedMakers(query);
  const price = parsePriceFilter(query.price);
  const date = parseDateFilter(query.date);
  const saleOnly = isWorksListSaleQuery(query);

  const result: DmmItem[] = [];

  for (const entry of entries) {
    if (keyword && !entry.haystack.includes(keyword)) continue;

    if (genres.length > 0 && !genres.some((genre) => entry.genres.includes(genre))) {
      continue;
    }

    if (makers.length > 0 && !makers.includes(entry.maker)) continue;

    if (saleOnly) {
      if (!isWorkOnSale(entry.item)) {
        continue;
      }
    }

    if (!matchesPriceFilterEntry(entry, price)) continue;

    if (!matchesDateFilterEntry(entry, date)) continue;

    result.push(entry.item);
  }

  return result;
}

export function getWorkFilterOptionsFromEntries(
  entries: WorkFilterEntry[],
): {
  genreOptions: WorkFilterOption[];
  makerOptions: WorkFilterOption[];
} {
  const genreCount = new Map<string, number>();
  const makerCount = new Map<string, number>();

  for (const entry of entries) {
    for (const genre of entry.genres) {
      genreCount.set(genre, (genreCount.get(genre) ?? 0) + 1);
    }

    if (entry.maker) {
      makerCount.set(entry.maker, (makerCount.get(entry.maker) ?? 0) + 1);
    }
  }

  const toOptions = (map: Map<string, number>): WorkFilterOption[] =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .map(([label, count]) => ({ label, value: label, count }));

  return {
    genreOptions: toOptions(genreCount),
    makerOptions: toOptions(makerCount),
  };
}

export function filterWorksByQuery(
  items: DmmItem[],
  query: WorksListQueryState,
): DmmItem[] {
  const keyword = query.q?.trim().toLowerCase();
  const genres = getAppliedGenres(query);
  const makers = getAppliedMakers(query);
  const price = parsePriceFilter(query.price);
  const date = parseDateFilter(query.date);
  const saleOnly = isWorksListSaleQuery(query);

  return items.filter((item) => {
    if (keyword) {
      const actresses = item.actress ?? item.iteminfo?.actress ?? [];
      const actressText = actresses.map((a) => a.name).join(" ");
      const makerName = getDmmItemMakerName(item) ?? "";
      const haystack =
        `${item.title} ${item.content_id} ${makerName} ${actressText}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    if (genres.length > 0) {
      const itemGenres = getDmmItemGenreNameList(item);
      if (!genres.some((genre) => itemGenres.includes(genre))) return false;
    }

    if (makers.length > 0) {
      const makerName = getDmmItemMakerName(item) ?? "";
      if (!makers.includes(makerName)) return false;
    }

    if (saleOnly) {
      if (!isWorkOnSale(item)) return false;
    }

    if (!matchesPriceFilter(item, price)) return false;
    if (!matchesDateFilterWithBounds(item, date)) return false;
    return true;
  });
}

export function getWorkFilterOptions(items: DmmItem[]): {
  genreOptions: WorkFilterOption[];
  makerOptions: WorkFilterOption[];
} {
  const genreCount = new Map<string, number>();
  const makerCount = new Map<string, number>();

  for (const item of items) {
    for (const genre of getDmmItemGenreNameList(item)) {
      genreCount.set(genre, (genreCount.get(genre) ?? 0) + 1);
    }

    const maker = getDmmItemMakerName(item);
    if (maker) {
      makerCount.set(maker, (makerCount.get(maker) ?? 0) + 1);
    }
  }

  const toOptions = (map: Map<string, number>): WorkFilterOption[] =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .map(([label, count]) => ({ label, value: label, count }));

  return {
    genreOptions: toOptions(genreCount),
    makerOptions: toOptions(makerCount),
  };
}

export function buildWorksQueryString(state: WorksListQueryState): string {
  const params = new URLSearchParams();
  const set = (key: string, value?: string) => {
    if (value && value.trim()) params.set(key, value);
  };

  set("q", state.q);
  set("sale", state.sale);
  set("filter", state.filter);
  if (state.sort && state.sort !== "popular") params.set("sort", state.sort);
  set("genres", state.genres);
  set("makers", state.makers);
  if (state.price && state.price !== "all") params.set("price", state.price);
  if (state.date && state.date !== "all") params.set("date", state.date);
  if (state.page && state.page !== "1") params.set("page", state.page);

  return params.toString();
}
