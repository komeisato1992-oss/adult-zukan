/**
 * UI / URL 向けの並び替え定数のみ（重い依存なし）。
 * クライアント・サーバー両方可。
 */

export type WorkSortKey =
  | "popular"
  | "fanza-new"
  | "added"
  | "release-new"
  | "price-desc"
  | "price-asc"
  | "rating"
  | "discount"
  | "today-views"
  | "total-views"
  | "duration-desc"
  | "random";

export const DEFAULT_WORK_SORT: WorkSortKey = "popular";
export const SALE_DEFAULT_WORK_SORT: WorkSortKey = "discount";

export const WORK_SORT_LABELS: Record<WorkSortKey, string> = {
  popular: "人気順",
  "fanza-new": "新着順",
  added: "追加順",
  "release-new": "発売日が新しい順",
  "price-desc": "価格が高い順",
  "price-asc": "価格が安い順",
  rating: "評価順",
  discount: "セール率順",
  "today-views": "本日の再生数順",
  "total-views": "総再生数順",
  "duration-desc": "再生時間が長い順",
  random: "🎲 ランダム",
};

export const HOME_WORK_SORT_KEYS: WorkSortKey[] = [
  "popular",
  "fanza-new",
  "added",
  "release-new",
  "price-desc",
  "price-asc",
  "duration-desc",
  "random",
];

export type WorkSortOption = {
  key: WorkSortKey;
  label: string;
};

export const DEFAULT_CATALOG_SORT_OPTIONS: WorkSortOption[] = [
  { key: "popular", label: WORK_SORT_LABELS.popular },
  { key: "fanza-new", label: WORK_SORT_LABELS["fanza-new"] },
  { key: "added", label: WORK_SORT_LABELS.added },
  { key: "release-new", label: WORK_SORT_LABELS["release-new"] },
  { key: "price-desc", label: WORK_SORT_LABELS["price-desc"] },
  { key: "price-asc", label: WORK_SORT_LABELS["price-asc"] },
  { key: "duration-desc", label: WORK_SORT_LABELS["duration-desc"] },
  { key: "random", label: WORK_SORT_LABELS.random },
];
