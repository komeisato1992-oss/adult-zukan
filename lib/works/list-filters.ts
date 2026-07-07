import type { DmmItem } from "@/lib/dmm/types";
import { getDmmItemGenreNameList, getDmmItemMakerName } from "@/lib/dmm/display";
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

function matchesDateFilter(item: DmmItem, filter: WorkDateFilterKey): boolean {
  if (filter === "all") return true;
  const ts = parseReleaseTimestamp(item);
  if (ts <= 0) return false;

  const bounds = getDateBounds();
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

export function filterWorksByQuery(
  items: DmmItem[],
  query: WorksListQueryState,
): DmmItem[] {
  const keyword = query.q?.trim().toLowerCase();
  const genre = query.genre?.trim();
  const maker = query.maker?.trim();
  const price = parsePriceFilter(query.price);
  const date = parseDateFilter(query.date);
  const saleOnly =
    query.sale === "1" || query.sale === "true" || query.filter === "sale";

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
      const current = parseDmmPrice(item.prices?.price);
      const list = parseDmmPrice(item.prices?.list_price);
      if (!(list > 0 && current > 0 && current < list)) return false;
    }

    if (!matchesPriceFilter(item, price)) return false;
    if (!matchesDateFilter(item, date)) return false;
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
