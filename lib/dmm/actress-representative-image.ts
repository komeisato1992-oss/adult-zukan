/**
 * 女優代表画像の選定ロジック（selectionVersion 3）
 * 単体 → 顔 → 着衣パッケージ → 品質。手動設定は上書きしない。
 */

import "server-only";

import type { DmmItem } from "@/lib/dmm/types";
import { getActressNamesFromItem } from "@/lib/dmm/actress-names";
import { getValidImageUrl, isValidImageUrl } from "@/lib/works";
import {
  getActressImageOverride,
  isManualActressImageOverride,
  type ActressImageOverride,
} from "@/lib/dmm/actress-image-overrides";

/** ロジック変更時に上げる。手動設定は version 変更でも維持 */
export const ACTRESS_IMAGE_SELECTION_VERSION = 3;

const MIN_ACCEPTABLE_SCORE = 25;
const MAX_CANDIDATES_PER_ACTRESS = 24;
/** 着衣候補が最高点のこの割合以上なら着衣を最終採用 */
const CLOTHED_PREFERENCE_RATIO = 0.85;

export type ClothingConfidence = "high" | "medium" | "low" | "unknown";

export type ActressImageSelectionReason =
  | "manual-override"
  | "automatic-stored"
  | "solo-face-likely"
  | "solo-clothed"
  | "solo-fallback"
  | "work-face-likely"
  | "work-fallback"
  | "default-image";

export type ScoreBreakdownItem = {
  label: string;
  points: number;
};

export type ActressRepresentativeImage = {
  imageUrl: string;
  workId: string | null;
  score: number;
  reason: ActressImageSelectionReason;
  faceDetected: boolean;
  isSoloWork: boolean;
  isFromMultiActressWork: boolean;
  selectionVersion: number;
  clothingConfidence?: ClothingConfidence;
  scoreBreakdown?: ScoreBreakdownItem[];
  faceSizeLabel?: string;
  imageQualityLabel?: string;
  skinExposurePenalty?: number;
  multiPersonPenalty?: number;
  textHeavyPenalty?: number;
};

export type ScoredCandidate = {
  imageUrl: string;
  contentId: string;
  score: number;
  isSoloWork: boolean;
  isSoloGenre: boolean;
  actressCount: number;
  isMainActress: boolean;
  faceLikely: boolean;
  faceDetected: boolean;
  faceSizeLabel: string;
  isCompilation: boolean;
  clothingConfidence: ClothingConfidence;
  clothedScore: number;
  imageQualityScore: number;
  imageQualityLabel: string;
  skinExposurePenalty: number;
  multiPersonPenalty: number;
  textHeavyPenalty: number;
  obstructionPenalty: number;
  explicitPenalty: number;
  scoreBreakdown: ScoreBreakdownItem[];
  catalogIndex: number;
  releaseTimestamp: number;
  popularityRank: number | null;
};

type ActressImageSelectionInput = {
  name: string;
  workCount: number;
  slug?: string;
};

type MemoryAnalysis = typeof globalThis & {
  __actressImageAnalysisCache?: Map<string, ClothingConfidence>;
};

function analysisCache(): Map<string, ClothingConfidence> {
  const store = globalThis as MemoryAnalysis;
  if (!store.__actressImageAnalysisCache) {
    store.__actressImageAnalysisCache = new Map();
  }
  return store.__actressImageAnalysisCache;
}

function analysisCacheKey(imageUrl: string): string {
  return `${imageUrl}::v${ACTRESS_IMAGE_SELECTION_VERSION}`;
}

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

const CLOTHED_GENRE_HINTS = [
  "制服",
  "女子校生",
  "セーラー服",
  "コスプレ",
  "コスチューム",
  "OL",
  "スーツ",
  "女教師",
  "ナース",
  "メイド",
  "着物",
  "浴衣",
  "着衣",
  "イメージビデオ",
  "イメージ",
];

const EXPLICIT_GENRE_HINTS = [
  "局部アップ",
  "局部",
  "中出し",
  "アナル",
  "ぶっかけ",
  "顔射",
  "露出",
  "野外露出",
  "全裸",
  "ヌード",
  "パイパン",
  "放尿",
  "潮吹き",
];

const TEXT_HEAVY_TITLE =
  /【[^】]{8,}】|※|注意|モザイク|検閲|無修正|FANZA限定|数量限定/i;

function estimateClothingConfidence(input: {
  genres: string[];
  title: string;
  isSoloWork: boolean;
  bodyFocus: boolean;
  imageUrl: string;
}): { confidence: ClothingConfidence; clothedScore: number; skinPenalty: number; explicitPenalty: number; breakdown: ScoreBreakdownItem[] } {
  const cache = analysisCache();
  const key = analysisCacheKey(input.imageUrl);
  const cached = cache.get(key);

  const breakdown: ScoreBreakdownItem[] = [];
  let clothedScore = 0;
  let skinPenalty = 0;
  let explicitPenalty = 0;

  const genreJoined = input.genres.map(normalizeGenreToken).join("|");
  const title = input.title;
  const clothedGenreHit = CLOTHED_GENRE_HINTS.some((hint) =>
    genreJoined.includes(normalizeGenreToken(hint)) ||
    title.includes(hint),
  );
  const explicitGenreHit = EXPLICIT_GENRE_HINTS.some((hint) =>
    genreJoined.includes(normalizeGenreToken(hint)),
  );
  const clothedTitleHit = /着衣|制服|セーラー|スーツ|ドレス|コスプレ|私服|OL|女教師/.test(
    title,
  );
  const nudeTitleHit = /全裸|ヌード|裸|脱ぎ|はだか|裸体|ぶっかけ|顔射|局部/.test(
    title,
  );

  let confidence: ClothingConfidence = cached ?? "unknown";

  if (input.bodyFocus || nudeTitleHit || explicitGenreHit) {
    confidence = "low";
    skinPenalty = 100;
    explicitPenalty = input.bodyFocus ? 200 : nudeTitleHit ? 180 : 100;
    breakdown.push({ label: "肌露出ペナルティ", points: -skinPenalty });
    if (explicitPenalty > 0) {
      breakdown.push({ label: "過激構図ペナルティ", points: -explicitPenalty });
    }
  } else if (clothedGenreHit || clothedTitleHit) {
    confidence = clothedGenreHit && clothedTitleHit ? "high" : "medium";
    clothedScore = confidence === "high" ? 150 : 100;
    breakdown.push({
      label: `着衣推定：${confidence === "high" ? "高" : "中"}`,
      points: clothedScore,
    });
    if (clothedGenreHit) {
      clothedScore += 80;
      breakdown.push({ label: "衣服領域が明確（ジャンル）", points: 80 });
    }
    if (/制服|スーツ|ドレス|コスプレ|セーラー|着物/.test(title) || clothedGenreHit) {
      clothedScore += 50;
      breakdown.push({ label: "衣服が明確に確認できる", points: 50 });
    }
  } else if (input.isSoloWork) {
    // 単体でも着衣断定はしない
    confidence = "unknown";
  } else {
    confidence = "unknown";
  }

  if (confidence === "unknown") {
    // 加点・減点なし（誤判定回避）
    clothedScore = 0;
    if (!input.bodyFocus && !nudeTitleHit && !explicitGenreHit) {
      skinPenalty = 0;
      explicitPenalty = 0;
    }
  }

  cache.set(key, confidence);
  return { confidence, clothedScore, skinPenalty, explicitPenalty, breakdown };
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
  const scoreBreakdown: ScoreBreakdownItem[] = [];

  let soloScore = 0;
  let multiPersonPenalty = 0;
  if (isSoloGenre && !isCompilation) {
    soloScore = 120;
    scoreBreakdown.push({ label: "単体作品", points: 120 });
  } else if (actressCount === 1 && !isCompilation) {
    soloScore = 100;
    scoreBreakdown.push({ label: "出演1名", points: 100 });
  } else if (actressCount >= 2) {
    multiPersonPenalty = 80;
    scoreBreakdown.push({ label: "複数女優出演", points: -80 });
  }
  if (actressCount >= 5) {
    multiPersonPenalty += 100;
    scoreBreakdown.push({ label: "対象外の顔が複数", points: -100 });
  } else if (actressCount >= 3) {
    multiPersonPenalty += 40;
    scoreBreakdown.push({ label: "複数人物", points: -40 });
  }

  let faceScore = 0;
  let faceLikely = false;
  let faceSizeLabel = "不明";
  if (isSoloWork && !isCompilation && !bodyFocus) {
    faceLikely = true;
    faceSizeLabel = "十分大きい（推定）";
    faceScore += 100;
    scoreBreakdown.push({ label: "顔が1つ明確（推定）", points: 100 });
    faceScore += 40;
    scoreBreakdown.push({ label: "顔が中央付近（推定）", points: 40 });
    faceScore += 40;
    scoreBreakdown.push({ label: "顔の占有率が十分", points: 40 });
  } else if (faceFriendlyGenre && !bodyFocus) {
    faceLikely = true;
    faceSizeLabel = "中程度（推定）";
    faceScore += 50;
    scoreBreakdown.push({ label: "顔寄りジャンル", points: 50 });
  } else if (bodyFocus) {
    faceSizeLabel = "小さい／隠れやすい";
    faceScore -= 80;
    scoreBreakdown.push({ label: "顔が検出できない（推定）", points: -80 });
  } else if (!isSoloWork) {
    faceSizeLabel = "小さい可能性";
    faceScore -= 30;
    scoreBreakdown.push({ label: "顔が小さい（推定）", points: -30 });
  }

  if (isMainActress) {
    faceScore += 20;
    scoreBreakdown.push({ label: "メイン出演", points: 20 });
  }
  if (title.includes(input.actressName)) {
    faceScore += 15;
    scoreBreakdown.push({ label: "タイトルに女優名", points: 15 });
  }

  const clothing = estimateClothingConfidence({
    genres,
    title,
    isSoloWork,
    bodyFocus,
    imageUrl,
  });
  scoreBreakdown.push(...clothing.breakdown);

  let textHeavyPenalty = 0;
  let obstructionPenalty = 0;
  if (TEXT_HEAVY_TITLE.test(title)) {
    textHeavyPenalty = 40;
    scoreBreakdown.push({ label: "文字面積が多い（タイトル装飾）", points: -40 });
  }
  if (/モザイク|黒塗り|検閲|修正/.test(title)) {
    obstructionPenalty = 70;
    scoreBreakdown.push({ label: "黒塗り・モザイクが目立つ", points: -70 });
  }
  if (/【/.test(title) && title.length > 40) {
    obstructionPenalty += 30;
    scoreBreakdown.push({ label: "顔周辺の大きな文字（推定）", points: -30 });
  }

  let imageQualityScore = 0;
  let imageQualityLabel = "標準";
  if (/pl\.jpe?g(\?|$)/i.test(imageUrl)) {
    imageQualityScore += 30;
    imageQualityLabel = "高解像度";
    scoreBreakdown.push({ label: "高解像度", points: 30 });
  }
  if (/ps\.jpe?g(\?|$)/i.test(imageUrl) || /jm\.jpe?g(\?|$)/i.test(imageUrl)) {
    imageQualityScore += 20;
    scoreBreakdown.push({
      label: "カード向けアスペクト（推定）",
      points: 20,
    });
  }
  if (/pt\.jpe?g(\?|$)/i.test(imageUrl)) {
    imageQualityScore -= 20;
    imageQualityLabel = "横長寄り";
    scoreBreakdown.push({ label: "極端な横長", points: -20 });
  }

  if (isCompilation) {
    multiPersonPenalty += 80;
    scoreBreakdown.push({ label: "総集編", points: -80 });
  }

  const releaseTimestamp = parseReleaseTimestamp(input.item);
  if (releaseTimestamp > 0) {
    const ageDays = (Date.now() - releaseTimestamp) / (1000 * 60 * 60 * 24);
    if (ageDays < 180) {
      imageQualityScore += 10;
      scoreBreakdown.push({ label: "比較的新しい作品", points: 10 });
    }
  }

  const popularityRank =
    typeof input.item.sourcePopularityRank === "number"
      ? input.item.sourcePopularityRank
      : null;
  if (popularityRank != null && popularityRank > 0 && popularityRank <= 100) {
    imageQualityScore += 8;
    scoreBreakdown.push({ label: "人気作品", points: 8 });
  }

  const score =
    soloScore +
    faceScore +
    clothing.clothedScore +
    imageQualityScore -
    clothing.explicitPenalty -
    multiPersonPenalty -
    obstructionPenalty -
    textHeavyPenalty -
    clothing.skinPenalty;

  // skinPenalty already in breakdown; avoid double subtract if also in clothing.skinPenalty path
  // Note: clothing.skinPenalty is subtracted above; breakdown already has negative points.
  // Fix: don't subtract skinPenalty twice — clothing.breakdown already includes it as negative labels
  // but clothing.skinPenalty is also subtracted. The breakdown points are for display only.
  // Actual score uses clothing.skinPenalty once. Good.

  return {
    imageUrl,
    contentId: input.item.content_id,
    score,
    isSoloWork,
    isSoloGenre,
    actressCount,
    isMainActress,
    faceLikely,
    faceDetected: faceLikely,
    faceSizeLabel,
    isCompilation,
    clothingConfidence: clothing.confidence,
    clothedScore: clothing.clothedScore,
    imageQualityScore,
    imageQualityLabel,
    skinExposurePenalty: clothing.skinPenalty,
    multiPersonPenalty,
    textHeavyPenalty,
    obstructionPenalty,
    explicitPenalty: clothing.explicitPenalty,
    scoreBreakdown,
    catalogIndex: input.catalogIndex,
    releaseTimestamp,
    popularityRank,
  };
}

function isClothedCandidate(candidate: ScoredCandidate): boolean {
  return (
    candidate.clothingConfidence === "high" ||
    candidate.clothingConfidence === "medium"
  );
}

function compareScoredCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (a.score !== b.score) return b.score - a.score;
  const aClothed = isClothedCandidate(a);
  const bClothed = isClothedCandidate(b);
  if (aClothed !== bClothed) return aClothed ? -1 : 1;
  if (a.faceLikely !== b.faceLikely) return a.faceLikely ? -1 : 1;
  if (a.isSoloWork !== b.isSoloWork) return a.isSoloWork ? -1 : 1;
  if (a.catalogIndex !== b.catalogIndex) return a.catalogIndex - b.catalogIndex;
  if (a.releaseTimestamp !== b.releaseTimestamp) {
    return b.releaseTimestamp - a.releaseTimestamp;
  }
  return a.contentId.localeCompare(b.contentId, "ja");
}

function pickBestCandidate(scored: ScoredCandidate[]): ScoredCandidate {
  const sorted = [...scored].sort(compareScoredCandidates);
  const top = sorted[0];
  if (!top) throw new Error("empty candidates");

  const clothed = sorted.filter(isClothedCandidate);
  if (clothed.length === 0) return top;

  const bestClothed = clothed[0]!;
  if (bestClothed.contentId === top.contentId) return top;

  // 着衣候補が最高点の 85% 以上なら着衣を優先
  if (bestClothed.score >= top.score * CLOTHED_PREFERENCE_RATIO) {
    return bestClothed;
  }
  return top;
}

function reasonFromCandidate(
  candidate: ScoredCandidate,
): ActressImageSelectionReason {
  if (candidate.isSoloWork && isClothedCandidate(candidate)) return "solo-clothed";
  if (candidate.isSoloWork && candidate.faceLikely) return "solo-face-likely";
  if (candidate.isSoloWork) return "solo-fallback";
  if (candidate.faceLikely) return "work-face-likely";
  return "work-fallback";
}

function overrideImageUrl(override: ActressImageOverride): string | null {
  return override.image_url ?? override.imageUrl ?? null;
}

function selectionFromOverride(
  override: ActressImageOverride,
  reason: ActressImageSelectionReason = "manual-override",
): ActressRepresentativeImage {
  return {
    imageUrl: overrideImageUrl(override) ?? "",
    workId: override.work_id ?? override.workId ?? null,
    score: override.score ?? 9999,
    reason,
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
    faceDetected: candidate.faceDetected,
    isSoloWork: candidate.isSoloWork,
    isFromMultiActressWork: !candidate.isSoloWork,
    selectionVersion: ACTRESS_IMAGE_SELECTION_VERSION,
    clothingConfidence: candidate.clothingConfidence,
    scoreBreakdown: candidate.scoreBreakdown,
    faceSizeLabel: candidate.faceSizeLabel,
    imageQualityLabel: candidate.imageQualityLabel,
    skinExposurePenalty: candidate.skinExposurePenalty,
    multiPersonPenalty: candidate.multiPersonPenalty,
    textHeavyPenalty: candidate.textHeavyPenalty,
  };
}

function scoreCandidatesForActress(input: {
  actressName: string;
  works: DmmItem[];
  catalogIndexById?: Map<string, number>;
}): ScoredCandidate[] {
  const catalogIndex =
    input.catalogIndexById ?? buildCatalogIndexMap(input.works);
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
  return scored;
}

/**
 * 1女優分の代表画像を選定する共通関数。
 * 優先: 手動 → 保存済み自動 → その場選定 → なし(デフォルト)
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

  if (override?.useDefault && isManualActressImageOverride(override)) {
    return undefined;
  }

  if (
    override &&
    isManualActressImageOverride(override) &&
    overrideImageUrl(override)
  ) {
    return selectionFromOverride(override, "manual-override");
  }

  if (
    override &&
    override.selection_type === "automatic" &&
    overrideImageUrl(override)
  ) {
    return selectionFromOverride(override, "automatic-stored");
  }

  const scored = scoreCandidatesForActress({
    actressName: input.actress.name,
    works: input.works,
    catalogIndexById: input.catalogIndexById,
  });

  if (scored.length === 0) return undefined;

  const topPool = scored.slice(0, MAX_CANDIDATES_PER_ACTRESS);
  const best = pickBestCandidate(topPool);
  if (!best || best.score < MIN_ACCEPTABLE_SCORE) {
    return undefined;
  }

  return selectionFromCandidate(best);
}

/** 公開・管理画面共通の代表画像取得 */
export function getActressRepresentativeImage(input: {
  actressId: string;
  actressName: string;
  works: DmmItem[];
}): ActressRepresentativeImage | undefined {
  return selectActressRepresentativeImage({
    actress: { name: input.actressName, slug: input.actressId },
    works: input.works,
  });
}

/**
 * 自動選定のみ（手動・保存済みを無視）。バッチ再選定用。
 */
export function selectActressRepresentativeImageAutomaticOnly(input: {
  actress: { name: string; slug?: string };
  works: DmmItem[];
  catalogIndexById?: Map<string, number>;
}): ActressRepresentativeImage | undefined {
  const scored = scoreCandidatesForActress({
    actressName: input.actress.name,
    works: input.works,
    catalogIndexById: input.catalogIndexById,
  });
  if (scored.length === 0) return undefined;
  const best = pickBestCandidate(scored.slice(0, MAX_CANDIDATES_PER_ACTRESS));
  if (!best || best.score < MIN_ACCEPTABLE_SCORE) return undefined;
  return selectionFromCandidate(best);
}

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
      actress: { name: actress.name, slug: actress.slug },
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
  const scored = scoreCandidatesForActress({
    actressName: input.actressName,
    works: input.works,
  });
  return scored.slice(0, input.limit ?? MAX_CANDIDATES_PER_ACTRESS).map((c) => ({
    ...c,
    reason: reasonFromCandidate(c),
  }));
}

export function clothingConfidenceLabel(
  confidence: ClothingConfidence,
): string {
  switch (confidence) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default:
      return "不明";
  }
}
