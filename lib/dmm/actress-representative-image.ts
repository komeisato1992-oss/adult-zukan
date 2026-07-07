import type { DmmItem } from "@/lib/dmm/types";
import { getValidImageUrl, isValidImageUrl } from "@/lib/works";

/** 代表画像として極力避けるキーワード */
export const REPRESENTATIVE_IMAGE_AVOID_KEYWORDS = [
  "BEST",
  "ベスト",
  "総集編",
  "Collection",
  "コレクション",
  "Complete",
  "コンプリート",
  "永久保存版",
  "240分",
  "300分",
  "480分",
  "10時間",
  "12時間",
] as const;

export const REPRESENTATIVE_IMAGE_TIER = {
  solo: 0,
  regular: 1,
  planning: 2,
  compilation: 3,
  best: 4,
  avoided: 5,
} as const;

export type RepresentativeImageTier =
  (typeof REPRESENTATIVE_IMAGE_TIER)[keyof typeof REPRESENTATIVE_IMAGE_TIER];

type WorkCandidate = {
  imageUrl: string;
  contentId: string;
  tier: RepresentativeImageTier;
  catalogIndex: number;
  releaseTimestamp: number;
};

function parseReleaseTimestamp(item: DmmItem): number {
  const raw = item.date?.trim();
  if (!raw) return 0;

  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getGenreNames(item: DmmItem): string[] {
  return (item.iteminfo?.genre ?? [])
    .map((genre) => genre.name)
    .filter(Boolean);
}

function getActressNames(item: DmmItem): string[] {
  return (item.actress ?? item.iteminfo?.actress ?? [])
    .map((actress) => actress.name)
    .filter(Boolean);
}

function containsAvoidKeyword(text: string): boolean {
  const normalized = text.toLowerCase();
  return REPRESENTATIVE_IMAGE_AVOID_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase()),
  );
}

function isCompilationWork(item: DmmItem): boolean {
  const genres = getGenreNames(item);
  if (genres.some((name) => name.includes("総集編"))) return true;
  return /総集編/.test(item.title);
}

function isBestWork(item: DmmItem): boolean {
  const genres = getGenreNames(item);
  if (genres.some((name) => name.includes("ベスト"))) return true;

  const title = item.title;
  return (
    /ベスト/i.test(title) ||
    /\bBEST\b/i.test(title) ||
    /コレクション/i.test(title) ||
    /Collection/i.test(title) ||
    /コンプリート/i.test(title) ||
    /Complete/i.test(title) ||
    /永久保存版/.test(title)
  );
}

function isPlanningWork(item: DmmItem): boolean {
  return getGenreNames(item).some((name) => name.includes("企画"));
}

function isSoloWork(item: DmmItem): boolean {
  if (getGenreNames(item).some((name) => name === "単体作品")) return true;

  const actresses = getActressNames(item);
  return (
    actresses.length === 1 &&
    !isCompilationWork(item) &&
    !isBestWork(item) &&
    !containsAvoidKeyword(item.title)
  );
}

export function getRepresentativeImageTier(item: DmmItem): RepresentativeImageTier {
  if (containsAvoidKeyword(item.title)) {
    return REPRESENTATIVE_IMAGE_TIER.avoided;
  }
  if (isSoloWork(item)) {
    return REPRESENTATIVE_IMAGE_TIER.solo;
  }
  if (isBestWork(item)) {
    return REPRESENTATIVE_IMAGE_TIER.best;
  }
  if (isCompilationWork(item)) {
    return REPRESENTATIVE_IMAGE_TIER.compilation;
  }
  if (isPlanningWork(item)) {
    return REPRESENTATIVE_IMAGE_TIER.planning;
  }
  return REPRESENTATIVE_IMAGE_TIER.regular;
}

function compareCandidates(a: WorkCandidate, b: WorkCandidate): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.catalogIndex !== b.catalogIndex) return a.catalogIndex - b.catalogIndex;
  return b.releaseTimestamp - a.releaseTimestamp;
}

function buildCatalogIndexMap(items: DmmItem[]): Map<string, number> {
  return new Map(items.map((item, index) => [item.content_id, index]));
}

function buildWorkCandidate(
  item: DmmItem,
  catalogIndex: number,
): WorkCandidate | null {
  const imageUrl = getValidImageUrl(item, ["large", "list"]);
  if (!isValidImageUrl(imageUrl) || !imageUrl) return null;

  return {
    imageUrl,
    contentId: item.content_id,
    tier: getRepresentativeImageTier(item),
    catalogIndex,
    releaseTimestamp: parseReleaseTimestamp(item),
  };
}

function filterCandidatesForActress(
  candidates: WorkCandidate[],
): WorkCandidate[] {
  const hasSolo = candidates.some(
    (candidate) => candidate.tier === REPRESENTATIVE_IMAGE_TIER.solo,
  );

  let filtered = candidates;
  if (hasSolo) {
    filtered = filtered.filter(
      (candidate) =>
        candidate.tier !== REPRESENTATIVE_IMAGE_TIER.compilation &&
        candidate.tier !== REPRESENTATIVE_IMAGE_TIER.best,
    );
  }

  const hasPreferred = filtered.some(
    (candidate) => candidate.tier !== REPRESENTATIVE_IMAGE_TIER.avoided,
  );
  if (hasPreferred) {
    filtered = filtered.filter(
      (candidate) => candidate.tier !== REPRESENTATIVE_IMAGE_TIER.avoided,
    );
  }

  return [...filtered].sort(compareCandidates);
}

type ActressImageSelectionInput = {
  name: string;
  workCount: number;
};

/**
 * 女優ごとの代表画像を選定する。
 * 人気順（作品数）で先に割り当て、同じ画像の重複を避ける。
 */
export function buildActressRepresentativeImageMap(
  items: DmmItem[],
  actresses: ActressImageSelectionInput[],
): Map<string, string> {
  const catalogIndex = buildCatalogIndexMap(items);
  const candidatesByActress = new Map<string, WorkCandidate[]>();

  for (const item of items) {
    const candidate = buildWorkCandidate(
      item,
      catalogIndex.get(item.content_id) ?? Number.MAX_SAFE_INTEGER,
    );
    if (!candidate) continue;

    for (const actressName of getActressNames(item)) {
      const existing = candidatesByActress.get(actressName) ?? [];
      existing.push(candidate);
      candidatesByActress.set(actressName, existing);
    }
  }

  const usedImageUrls = new Set<string>();
  const imageByActress = new Map<string, string>();

  const orderedActresses = [...actresses].sort(
    (a, b) =>
      b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
  );

  for (const actress of orderedActresses) {
    const candidates = filterCandidatesForActress(
      candidatesByActress.get(actress.name) ?? [],
    );

    const selected = candidates.find(
      (candidate) => !usedImageUrls.has(candidate.imageUrl),
    );

    if (selected) {
      imageByActress.set(actress.name, selected.imageUrl);
      usedImageUrls.add(selected.imageUrl);
    }
  }

  return imageByActress;
}
