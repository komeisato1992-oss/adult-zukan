import type { DmmItem } from "@/lib/dmm/types";
import type { AdultImageStatus } from "@/lib/works/image-status-shared";

/** 候補取得の並び順（FANZA API sort 切替用） */
export type AdultImportSortMode = "popular" | "new";

/** @deprecated AdultImportSortMode を使用 */
export type ImportFetchSort = AdultImportSortMode;

/** @deprecated AdultImportSortMode を使用 */
export type ImportSortMode = AdultImportSortMode;

export const ADULT_IMPORT_SORT_OPTIONS = [
  { value: "popular", label: "FANZA人気順" },
  { value: "new", label: "FANZA新着順" },
] as const satisfies ReadonlyArray<{
  value: AdultImportSortMode;
  label: string;
}>;

export const IMPORT_SORT_MODE_LABELS: Record<AdultImportSortMode, string> = {
  popular: "FANZA人気順",
  new: "FANZA新着順",
};

/** FANZA/DMM ItemList API の sort クエリ値 */
export const ADULT_IMPORT_API_SORT: Record<
  AdultImportSortMode,
  "rank" | "date"
> = {
  popular: "rank",
  new: "date",
};

export function isAdultImportSortMode(
  value: unknown,
): value is AdultImportSortMode {
  return value === "popular" || value === "new";
}

export function getAdultImportSortLabel(mode: AdultImportSortMode): string {
  return IMPORT_SORT_MODE_LABELS[mode];
}

export type ImportCandidateMeta = {
  sourceSort: AdultImportSortMode;
  sourceOffset: number;
  sourceIndex: number;
  absolutePopularityPosition: number;
};

export type FetchedImportCandidate = {
  item: DmmItem;
  contentId: string;
  productId: string;
  /** 追加時の sourcePopularityRank 用（= absolutePopularityPosition） */
  rankPosition: number | null;
  candidateMeta: ImportCandidateMeta;
  /** large→list→small で解決した判定用URL（プレースホルダー含む） */
  packageImage?: string | null;
  /** 候補取得時の画像判定結果 */
  imageStatus?: AdultImageStatus | null;
  imageStatusCheckedAt?: string | null;
  /** packageImage が空（URLなし） */
  imageUrlMissing?: boolean;
};

export type FetchImportCandidatesSummary = {
  sort: AdultImportSortMode;
  requestedCount: number;
  maxScanCount: number;
  apiFetchedCount: number;
  publishedExcludedCount: number;
  duplicateExcludedCount: number;
  invalidExcludedCount: number;
  imageMissingExcludedCount: number;
  candidateCount: number;
  catalogCount: number;
  startOffset: number;
  nextOffset: number;
  scanStartOffset: number;
  scanEndOffset: number;
  popularityRangeMin: number | null;
  popularityRangeMax: number | null;
  targetReached: boolean;
  message: string;
  /** 候補取得直後の画像判定集計 */
  imageOkCount?: number;
  imageNowPrintingCount?: number;
  imageFetchFailedCount?: number;
  imageNoUrlCount?: number;
  imageGetCount?: number;
  imageCheckMessage?: string;
  initialSelectedCount?: number;
};

export type FetchImportCandidatesResult = {
  candidates: FetchedImportCandidate[];
  summary: FetchImportCandidatesSummary;
};

export type AddSelectedWorksSummary = {
  selectedCount: number;
  addedCount: number;
  catalogDuplicateCount: number;
  selectionDuplicateCount: number;
  invalidCount: number;
  /** 画像なしで追加拒否した件数 */
  imageMissingExcludedCount?: number;
  retried: boolean;
  catalogCountAfter?: number;
  updatedShardFiles?: string[];
  newShardFiles?: string[];
  githubCommitSucceeded?: boolean;
  /** 第4段階: works マスターへ保存した場合 */
  storageTarget?: "supabase" | "local" | "git";
  storageLabel?: string;
  publishedStatus?: "published" | "draft";
  worksMasterUpserted?: boolean;
  usedJsonFallback?: boolean;
  supabaseSavedCount?: number;
  jsonFallbackCount?: number;
};

export type AddSelectedWorkInput = {
  contentId: string;
  item: DmmItem;
  sourcePopularityRank?: number | null;
  /** FANZA新着順（sort=date）の取得順位 */
  fanzaNewRank?: number | null;
  /** 候補取得時の判定結果。あれば追加時に画像GETしない */
  imageStatus?: AdultImageStatus | null;
  imageStatusCheckedAt?: string | null;
  packageImage?: string | null;
};
