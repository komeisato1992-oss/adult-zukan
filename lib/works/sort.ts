import type { DmmItem } from "@/lib/dmm/types";
import { parseDmmPrice } from "@/lib/utils";

export type WorkSortKey =
  | "popular"
  | "new"
  | "price-desc"
  | "price-asc"
  | "today-views"
  | "total-views"
  | "duration-desc";

export const DEFAULT_WORK_SORT: WorkSortKey = "popular";

export const WORK_SORT_LABELS: Record<WorkSortKey, string> = {
  popular: "人気順",
  new: "新着順",
  "price-desc": "価格高い順",
  "price-asc": "価格安い順",
  "today-views": "本日の再生数順",
  "total-views": "総再生数順",
  "duration-desc": "再生時間長い順",
};

export const HOME_WORK_SORT_KEYS: WorkSortKey[] = [
  "popular",
  "new",
  "price-desc",
  "price-asc",
  "duration-desc",
];

export type WorkSortOption = {
  key: WorkSortKey;
  label: string;
};

type DmmItemWithViews = DmmItem & {
  todayViewCount?: number;
  totalViewCount?: number;
};

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;
  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getItemPrice(item: DmmItem): number {
  return parseDmmPrice(item.prices?.price);
}

export function getItemDurationMinutes(item: DmmItem): number {
  if (!item.volume?.trim()) return 0;
  const parsed = parseInt(item.volume, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getTodayViewCount(item: DmmItem): number | null {
  const value = (item as DmmItemWithViews).todayViewCount;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getTotalViewCount(item: DmmItem): number | null {
  const value = (item as DmmItemWithViews).totalViewCount;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseWorkSortParam(value?: string | null): WorkSortKey {
  switch (value) {
    case "new":
    case "price-desc":
    case "price-asc":
    case "today-views":
    case "total-views":
    case "duration-desc":
      return value;
    case "rank":
    case "popular":
    default:
      return DEFAULT_WORK_SORT;
  }
}

export function getWorksSortOptions(items: DmmItem[]): WorkSortOption[] {
  const keys: WorkSortKey[] = ["popular", "new", "price-desc", "price-asc"];

  if (items.some((item) => getTodayViewCount(item) !== null)) {
    keys.push("today-views");
  }
  if (items.some((item) => getTotalViewCount(item) !== null)) {
    keys.push("total-views");
  }

  keys.push("duration-desc");

  return keys.map((key) => ({ key, label: WORK_SORT_LABELS[key] }));
}

export function sortWorks(
  items: DmmItem[],
  sort: WorkSortKey = DEFAULT_WORK_SORT,
): DmmItem[] {
  if (sort === DEFAULT_WORK_SORT) return items;

  const sorted = [...items];

  switch (sort) {
    case "new":
      return sorted.sort(
        (a, b) => parseReleaseTimestamp(b) - parseReleaseTimestamp(a),
      );
    case "price-desc":
      return sorted.sort((a, b) => getItemPrice(b) - getItemPrice(a));
    case "price-asc":
      return sorted.sort((a, b) => getItemPrice(a) - getItemPrice(b));
    case "today-views":
      return sorted.sort(
        (a, b) =>
          (getTodayViewCount(b) ?? -1) - (getTodayViewCount(a) ?? -1),
      );
    case "total-views":
      return sorted.sort(
        (a, b) =>
          (getTotalViewCount(b) ?? -1) - (getTotalViewCount(a) ?? -1),
      );
    case "duration-desc":
      return sorted.sort(
        (a, b) => getItemDurationMinutes(b) - getItemDurationMinutes(a),
      );
    default:
      return items;
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

  if (sort !== DEFAULT_WORK_SORT) {
    params.set("sort", sort);
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function getWorksSortPageTitle(sort: WorkSortKey): string | null {
  switch (sort) {
    case "new":
      return "新着作品一覧";
    case "price-desc":
      return "価格が高い順 作品一覧";
    case "price-asc":
      return "価格が安い順 作品一覧";
    case "today-views":
      return "本日の再生数順 作品一覧";
    case "total-views":
      return "総再生数順 作品一覧";
    case "duration-desc":
      return "再生時間が長い順 作品一覧";
    case "popular":
      return null;
  }
}
