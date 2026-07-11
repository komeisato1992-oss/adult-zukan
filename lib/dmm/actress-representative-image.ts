/**
 * 女優代表画像の選定ロジック（単体作品・顔が写りやすいパッケージ優先）
 *
 * 顔検出はビルド/表示時に外部画像を大量取得しない方針のため、
 * ジャンル・出演人数・タイトルによるヒューリスティックで「顔が写りにくい画像」を減点する。
 */

import "server-only";

import type { DmmItem } from "@/lib/dmm/types";
import { getActressNamesFromItem } from "@/lib/dmm/actress-names";
import { getValidImageUrl, isValidImageUrl } from "@/lib/works";
import {
  getActressImageOverride,
  type ActressImageOverride,
} from "@/lib/dmm/actress-image-overrides";

/** ロジック変更時に上げる。インデックス再生成・表示側の再選定に使う */
export const ACTRESS_IMAGE_SELECTION_VERSION = 2;

const MIN_ACCEPTABLE_SCORE = 25;
const MAX_CANDIDATES_PER_ACTRESS = 20;

export type ActressImageSelectionReason =
  | "manual-override"
  | "solo-face-likely"
  | "solo-fallback"
  | "work-face-likely"
  | "work-fallback"
  | "default-image";

export type ActressRepresentativeImage = {
  imageUrl: string;
  workId: string | null;
  score: number;
  reason: ActressImageSelectionReason;
  /** ヒューリスティック上、顔が写っている可能性が高い */
  faceDetected: boolean;
  isSoloWork: boolean;
  isFromMultiActressWork: boolean;
  selectionVersion: number;
};

type ScoredCandidate = {
  imageUrl: string;
  contentId: string;
  score: number;
  isSoloWork: boolean;
  isSoloGenre: boolean;
  actressCount: number;
  isMainActress: boolean;
  faceLikely: boolean;
  isCompilation: boolean;
  catalogIndex: number;
  releaseTimestamp: number;
  popularityRank: number | null;
};

type ActressImageSelectionInput = {
  name: string;
  workCount: number;
};

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;
  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getGenreNames(item: DmmItem): string[] {
  const raw = item.iteminfo?.genre;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const name = (entry as { name?: unknown }).name;
      return typeof name === "string" ? name.trim() : "";
    })
    .filter(Boolean);
}

function normalizeGenreToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

/** 既存ジャンル名「単体作品」を最優先。表記揺れも吸収 */
export function isSoloWorkGenre(genres: string[]): boolean {
  return genres.some((genre) => {
    const normalized = normalizeGenreToken(genre);
    return (
      normalized === "単体作品" ||
      normalized === "単体" ||
      normalized === "solo" ||
      normalized === "exclusivesolo"
    );
  });
}

export function isCompilationWork(item: DmmItem, genres: string[]): boolean {
  const title = String(item.title ?? "");
  const genreHit = genres.some((genre) => {
    const normalized = normalizeGenreToken(genre);
    return (
      normalized.includes("総集編") ||
      normalized.includes("ベスト") ||
      normalized.includes("best") ||
      normalized.includes("オムニバス") ||
      normalized.includes("作品集")
    );
  });

  const titleHit =
    /総集編|BEST|ベスト|オムニバス|作品集|COMPLETE\s*BOX|\d+\s*時間/i.test(
      title,
    );

  return genreHit || titleHit;
}

/** 顔が写りにくい／身体寄りパッケージのジャンル */
function hasBodyFocusGenre(genres: string[]): boolean {
  return genres.some((genre) => {
    const normalized = normalizeGenreToken(genre);
    return (
      normalized.includes("局部アップ") ||
      normalized === "局部" ||
      normalized.includes("局部")
    );
  });
}

function hasFaceFriendlyGenre(genres: string[]): boolean {
  return genres.some((genre) => {
    const normalized = normalizeGenreToken(genre);
    return normalized.includes("美少女") || normalized.includes("女子校生");
  });
}

function buildCatalogIndexMap(items: DmmItem[]): Map<string, number> {
  return new Map(items.map((item, index) => [item.content_id, index]));
}

function scoreCandidate(input: {
  item: DmmItem;
  actressName: string;
  catalogIndex: number;
}): ScoredCandidate | null {
  const imageUrl = getValidImageUrl(input.item, ["large", "list"]);
  if (!isValidImageUrl(imageUrl) || !imageUrl) return null;

  const actressNames = getActressNamesFromItem(input.item);
  if (actressNames.length === 0) return null;
  if (!actressNames.includes(input.actressName)) return null;

  const genres = getGenreNames(input.item);
  const isSoloGenre = isSoloWorkGenre(genres);
  const actressCount = actressNames.length;
  const isSoloWork = isSoloGenre || actressCount === 1;
  const isMainActress = actressNames[0] === input.actressName;
  const title = String(input.item.title ?? "");
  const isCompilation = isCompilationWork(input.item, genres);
  const bodyFocus = hasBodyFocusGenre(genres);
  const faceFriendlyGenre = hasFaceFriendlyGenre(genres);

  let score = 0;

  // 優先度1-2: 単体
  if (isSoloGenre && !isCompilation) score += 100;
  else if (actressCount === 1 && !isCompilation) score += 80;
  else if (isSoloGenre) score += 40;
  else if (actressCount === 1) score += 30;

  // メイン出演
  if (isMainActress) score += 30;
  if (title.includes(input.actressName)) score += 20;

  // 顔が写りやすさ（ヒューリスティック）
  let faceLikely = false;
  if (isSoloWork && !isCompilation && !bodyFocus) {
    faceLikely = true;
    score += 100;
  }
  if (faceFriendlyGenre && !bodyFocus) score += 15;
  if (bodyFocus) {
    score -= 120;
    faceLikely = false;
  }

  // 総集編・複数人
  if (isCompilation) score -= 80;
  if (/女優ベスト|SPECIAL\s*BEST|COMPLETE/i.test(title)) score -= 50;
  if (actressCount >= 5) score -= 60;
  else if (actressCount >= 3) score -= 35;
  else if (actressCount >= 2) score -= 20;

  // 解像度・新しさ・人気
  if (/pl\.jpe?g(\?|$)/i.test(imageUrl)) score += 10;
  const releaseTimestamp = parseReleaseTimestamp(input.item);
  if (releaseTimestamp > 0) {
    const ageDays =
      (Date.now() - releaseTimestamp) / (1000 * 60 * 60 * 24);
    if (ageDays < 180) score += 20;
    else if (ageDays < 365) score += 12;
    else if (ageDays < 730) score += 5;
  }

  const popularityRank =
    typeof input.item.sourcePopularityRank === "number"
      ? input.item.sourcePopularityRank
      : null;
  if (popularityRank != null && popularityRank > 0) {
    if (popularityRank <= 100) score += 20;
    else if (popularityRank <= 500) score += 12;
    else if (popularityRank <= 2000) score += 5;
  }

  // カタログ上位（人気寄り）をわずかに加点
  if (input.catalogIndex < 500) score += 8;
  else if (input.catalogIndex < 2000) score += 4;

  return {
    imageUrl,
    contentId: input.item.content_id,
    score,
    isSoloWork,
    isSoloGenre,
    actressCount,
    isMainActress,
    faceLikely,
    isCompilation,
    catalogIndex: input.catalogIndex,
    releaseTimestamp,
    popularityRank,
  };
}

function compareScoredCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.faceLikely !== b.faceLikely) return a.faceLikely ? -1 : 1;
  if (a.isSoloWork !== b.isSoloWork) return a.isSoloWork ? -1 : 1;
  if (a.catalogIndex !== b.catalogIndex) return a.catalogIndex - b.catalogIndex;
  if (a.releaseTimestamp !== b.releaseTimestamp) {
    return b.releaseTimestamp - a.releaseTimestamp;
  }
  return a.contentId.localeCompare(b.contentId, "ja");
}

function reasonFromCandidate(
  candidate: ScoredCandidate,
): ActressImageSelectionReason {
  if (candidate.isSoloWork && candidate.faceLikely) return "solo-face-likely";
  if (candidate.isSoloWork) return "solo-fallback";
  if (candidate.faceLikely) return "work-face-likely";
  return "work-fallback";
}

function selectionFromOverride(
  override: ActressImageOverride,
): ActressRepresentativeImage {
  return {
    imageUrl: override.imageUrl ?? "",
    workId: override.workId ?? null,
    score: override.score ?? 9999,
    reason: "manual-override",
    faceDetected: override.faceDetected ?? true,
    isSoloWork: override.isSoloWork ?? false,
    isFromMultiActressWork: !(override.isSoloWork ?? false),
    selectionVersion: ACTRESS_IMAGE_SELECTION_VERSION,
  };
}

function selectionFromCandidate(
  candidate: ScoredCandidate,
): ActressRepresentativeImage {
  return {
    imageUrl: candidate.imageUrl,
    workId: candidate.contentId,
    score: candidate.score,
    reason: reasonFromCandidate(candidate),
    faceDetected: candidate.faceLikely,
    isSoloWork: candidate.isSoloWork,
    isFromMultiActressWork: !candidate.isSoloWork,
    selectionVersion: ACTRESS_IMAGE_SELECTION_VERSION,
  };
}

/**
 * 1女優分の代表画像を選定する共通関数。
 */
export function selectActressRepresentativeImage(input: {
  actress: { name: string; slug?: string };
  works: DmmItem[];
  catalogIndexById?: Map<string, number>;
}): ActressRepresentativeImage | undefined {
  const override = getActressImageOverride(
    input.actress.slug ?? input.actress.name,
    input.actress.name,
  );
  if (override?.imageUrl) {
    if (override.useDefault) return undefined;
    return selectionFromOverride(override);
  }

  const catalogIndex =
    input.catalogIndexById ?? buildCatalogIndexMap(input.works);

  const scored: ScoredCandidate[] = [];
  for (const item of input.works) {
    const candidate = scoreCandidate({
      item,
      actressName: input.actress.name,
      catalogIndex: catalogIndex.get(item.content_id) ?? Number.MAX_SAFE_INTEGER,
    });
    if (candidate) scored.push(candidate);
  }

  if (scored.length === 0) return undefined;

  scored.sort(compareScoredCandidates);
  const top = scored.slice(0, MAX_CANDIDATES_PER_ACTRESS);
  const best = top[0];
  if (!best || best.score < MIN_ACCEPTABLE_SCORE) {
    return undefined;
  }

  return selectionFromCandidate(best);
}

/**
 * 女優一覧・インデックス再生成用。全女優の代表画像マップを構築する。
 */
export function buildActressRepresentativeImageMap(
  items: DmmItem[],
  actresses: ActressImageSelectionInput[],
): Map<string, ActressRepresentativeImage> {
  const catalogIndex = buildCatalogIndexMap(items);
  const worksByActress = new Map<string, DmmItem[]>();

  for (const item of items) {
    for (const actressName of getActressNamesFromItem(item)) {
      const list = worksByActress.get(actressName) ?? [];
      list.push(item);
      worksByActress.set(actressName, list);
    }
  }

  const imageByActress = new Map<string, ActressRepresentativeImage>();

  for (const actress of actresses) {
    const selection = selectActressRepresentativeImage({
      actress: { name: actress.name },
      works: worksByActress.get(actress.name) ?? [],
      catalogIndexById: catalogIndex,
    });
    if (selection) {
      imageByActress.set(actress.name, selection);
    }
  }

  return imageByActress;
}

/** デバッグ・管理画面用に候補を返す */
export function listActressImageCandidates(input: {
  actressName: string;
  works: DmmItem[];
  limit?: number;
}): Array<ScoredCandidate & { reason: ActressImageSelectionReason }> {
  const catalogIndex = buildCatalogIndexMap(input.works);
  const scored: ScoredCandidate[] = [];
  for (const item of input.works) {
    const candidate = scoreCandidate({
      item,
      actressName: input.actressName,
      catalogIndex: catalogIndex.get(item.content_id) ?? Number.MAX_SAFE_INTEGER,
    });
    if (candidate) scored.push(candidate);
  }
  scored.sort(compareScoredCandidates);
  return scored.slice(0, input.limit ?? MAX_CANDIDATES_PER_ACTRESS).map((c) => ({
    ...c,
    reason: reasonFromCandidate(c),
  }));
}
