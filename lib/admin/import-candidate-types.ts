import type { ImportCollectionMode } from "@/lib/admin/import-collect-types";
import type { DmmItem } from "@/lib/dmm/types";

export type ImportCandidateStatus = "candidate" | "added" | "excluded";

export type StoredImportCandidate = {
  content_id: string;
  title: string;
  imageURL: string;
  actresses: string[];
  maker: string;
  label: string;
  series: string;
  genres: string[];
  price: string;
  releaseDate: string;
  duration: number | null;
  affiliateURL: string;
  description: string;
  sampleImages: string[];
  source: string;
  collectedAt: string;
  status: ImportCandidateStatus;
  collectionMode?: ImportCollectionMode;
  /** カタログ追加用の完全な DMM 作品データ */
  item: DmmItem;
};

export type ImportCandidateSortKey =
  | "collectedAt-desc"
  | "releaseDate-desc"
  | "price-desc"
  | "actress-first"
  | "image-first"
  | "random";

export const IMPORT_CANDIDATE_SORT_LABELS: Record<ImportCandidateSortKey, string> = {
  "collectedAt-desc": "収集日が新しい順",
  "releaseDate-desc": "発売日が新しい順",
  "price-desc": "価格が高い順",
  "actress-first": "女優あり優先",
  "image-first": "画像あり優先",
  random: "ランダム",
};

export type ImportCandidatesSummary = {
  publishedCount: number;
  /** catalog-snapshot.json の総件数（掲載作品数とは別） */
  catalogTotalCount: number;
  candidateCount: number;
  addedCount: number;
  excludedCount: number;
  lastCollectedAt: string | null;
  lastNewCollectedAt: string | null;
  lastPastCollectedAt: string | null;
  collectionState: {
    pastOffset: number;
    nextPastOffset: number;
    pageSize: number;
    cycleCount: number;
  };
};

export type ImportCandidateListItem = {
  contentId: string;
  item: DmmItem;
  source: string;
  collectedAt: string;
  status?: ImportCandidateStatus;
  isAdded?: boolean;
  isExcluded?: boolean;
};

export type ImportCandidatesListResult = {
  summary: ImportCandidatesSummary;
  candidates: ImportCandidateListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
};
