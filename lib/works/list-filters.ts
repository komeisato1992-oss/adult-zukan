import {
  getDmmItemGenreNameList,
  getDmmItemMakerName,
} from "@/lib/dmm/display";
import {
  getCurrentPrice,
  getRegularPrice,
  isDmmItemOnSale,
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
  { key: "all", label: "すべて" },
  { key: "today", label: "今日" },
  { key: "this-week", label: "今週" },
  { key: "this-month", label: "今月" },
  { key: "this-year", label: "今年" },
];

export type WorksListQueryState = {
  q?: string;
  sale?: string;
  filter?: string;
  sort?: string;
  genre?: string;
  maker?: string;
  price?: string;
  date?: string;
  page?: string;
};

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

function getDateBounds() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  const day = weekStart.getDay();
  const diff = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diff);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  return {
    todayStart: todayStart.getTime(),
    weekStart: weekStart.getTime(),
    monthStart: monthStart.getTime(),
    yearStart: yearStart.getTime(),
  };
}

function matchesDateFilterWithBounds(
  item: DmmItem,
  filter: WorkDateFilterKey,
  bounds: ReturnType<typeof getDateBounds>,
): boolean {
  if (filter === "all") return true;
  const ts = parseReleaseTimestamp(item);
  if (ts <= 0) return false;

  switch (filter) {
    case "today":
      return ts >= bounds.todayStart;
    case "this-week":
      return ts >= bounds.weekStart;
    case "this-month":
      return ts >= bounds.monthStart;
    case "this-year":
      return ts >= bounds.yearStart;
    default:
      return true;
  }
}

function matchesDateFilter(item: DmmItem, filter: WorkDateFilterKey): boolean {
  if (filter === "all") return true;
  return matchesDateFilterWithBounds(item, filter, getDateBounds());
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
  bounds: ReturnType<typeof getDateBounds>,
): boolean {
  if (filter === "all") return true;
  if (entry.releaseTs <= 0) return false;

  switch (filter) {
    case "today":
      return entry.releaseTs >= bounds.todayStart;
    case "this-week":
      return entry.releaseTs >= bounds.weekStart;
    case "this-month":
      return entry.releaseTs >= bounds.monthStart;
    case "this-year":
      return entry.releaseTs >= bounds.yearStart;
    default:
      return true;
  }
}

export function filterWorkEntriesByQuery(
  entries: WorkFilterEntry[],
  query: WorksListQueryState,
): DmmItem[] {
  const keyword = query.q?.trim().toLowerCase();
  const genre = query.genre?.trim();
  const maker = query.maker?.trim();
  const price = parsePriceFilter(query.price);
  const date = parseDateFilter(query.date);
  const saleOnly = isWorksListSaleQuery(query);
  const dateBounds = date !== "all" ? getDateBounds() : null;

  const result: DmmItem[] = [];

  for (const entry of entries) {
    if (keyword && !entry.haystack.includes(keyword)) continue;

    if (genre && !entry.genres.includes(genre)) continue;

    if (maker && entry.maker !== maker) continue;

    if (saleOnly) {
      if (!isDmmItemOnSale(entry.item)) {
        continue;
      }
    }

    if (!matchesPriceFilterEntry(entry, price)) continue;

    if (dateBounds && !matchesDateFilterEntry(entry, date, dateBounds)) continue;

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
  const genre = query.genre?.trim();
  const maker = query.maker?.trim();
  const price = parsePriceFilter(query.price);
  const date = parseDateFilter(query.date);
  const saleOnly = isWorksListSaleQuery(query);
  const dateBounds = date !== "all" ? getDateBounds() : null;

  return items.filter((item) => {
    if (keyword) {
      const actresses = item.actress ?? item.iteminfo?.actress ?? [];
      const actressText = actresses.map((a) => a.name).join(" ");
      const makerName = getDmmItemMakerName(item) ?? "";
      const haystack =
        `${item.title} ${item.content_id} ${makerName} ${actressText}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    if (genre) {
      const genres = getDmmItemGenreNameList(item);
      if (!genres.includes(genre)) return false;
    }

    if (maker) {
      if (getDmmItemMakerName(item) !== maker) return false;
    }

    if (saleOnly) {
      if (!isDmmItemOnSale(item)) return false;
    }

    if (!matchesPriceFilter(item, price)) return false;
    if (dateBounds && !matchesDateFilterWithBounds(item, date, dateBounds)) {
      return false;
    }
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
  set("genre", state.genre);
  set("maker", state.maker);
  if (state.price && state.price !== "all") params.set("price", state.price);
  if (state.date && state.date !== "all") params.set("date", state.date);
  if (state.page && state.page !== "1") params.set("page", state.page);

  return params.toString();
}
