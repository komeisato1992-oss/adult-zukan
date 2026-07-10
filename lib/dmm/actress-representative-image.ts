import type { DmmItem } from "@/lib/dmm/types";
import { getActressNamesFromItem } from "@/lib/dmm/actress-names";
import { getValidImageUrl, isValidImageUrl } from "@/lib/works";

type WorkCandidate = {
  imageUrl: string;
  contentId: string;
  isSolo: boolean;
  catalogIndex: number;
  releaseTimestamp: number;
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

function getActressNames(item: DmmItem): string[] {
  return getActressNamesFromItem(item);
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

  const actressCount = getActressNames(item).length;

  return {
    imageUrl,
    contentId: item.content_id,
    isSolo: actressCount === 1,
    catalogIndex,
    releaseTimestamp: parseReleaseTimestamp(item),
  };
}

/**
 * 代表画像の優先順位:
 * ① 単体作品（出演女優1人）
 * ② 画像あり（候補構築時に除外済み）
 * ③ 人気作品（カタログ順位）
 * ④ 新しい作品（発売日）
 * ⑤ 複数人作品
 */
function compareRepresentativeCandidates(
  a: WorkCandidate,
  b: WorkCandidate,
): number {
  if (a.isSolo !== b.isSolo) {
    return a.isSolo ? -1 : 1;
  }
  if (a.catalogIndex !== b.catalogIndex) {
    return a.catalogIndex - b.catalogIndex;
  }
  if (a.releaseTimestamp !== b.releaseTimestamp) {
    return b.releaseTimestamp - a.releaseTimestamp;
  }
  return a.contentId.localeCompare(b.contentId, "ja");
}

export type ActressRepresentativeImage = {
  imageUrl: string;
  isFromMultiActressWork: boolean;
};

function selectRepresentativeImage(
  candidates: WorkCandidate[],
): ActressRepresentativeImage | undefined {
  if (candidates.length === 0) return undefined;

  const sorted = [...candidates].sort(compareRepresentativeCandidates);
  const selected = sorted.find((candidate) => candidate.isSolo) ?? sorted[0];
  if (!selected) return undefined;

  return {
    imageUrl: selected.imageUrl,
    isFromMultiActressWork: !selected.isSolo,
  };
}

/**
 * 女優ごとの代表画像を選定する。
 * 女優単位で独立して選び、単体作品の画像を最優先する。
 */
export function buildActressRepresentativeImageMap(
  items: DmmItem[],
  actresses: ActressImageSelectionInput[],
): Map<string, ActressRepresentativeImage> {
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

  const imageByActress = new Map<string, ActressRepresentativeImage>();

  for (const actress of actresses) {
    const selection = selectRepresentativeImage(
      candidatesByActress.get(actress.name) ?? [],
    );
    if (selection) {
      imageByActress.set(actress.name, selection);
    }
  }

  return imageByActress;
}
