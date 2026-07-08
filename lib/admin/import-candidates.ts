import "server-only";

import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";

export type ImportCandidateSource = "new" | "random";

export type ImportCandidate = {
  source: ImportCandidateSource;
  sourceLabel: string;
  item: DmmItem;
};

export type ImportCandidatesResult = {
  newWorks: ImportCandidate[];
  randomWorks: ImportCandidate[];
  totalCount: number;
  configured: boolean;
  message?: string;
};

const NEW_TARGET = 20;
const RANDOM_TARGET = 20;
const FETCH_HITS = 100;

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getExistingContentIds(): Set<string> {
  return new Set(readCatalogSnapshot().map((item) => item.content_id));
}

function isUnlistedCandidate(item: DmmItem, excludedIds: Set<string>): boolean {
  if (!item.content_id?.trim()) return false;
  if (excludedIds.has(item.content_id)) return false;
  return isValidDmmListItem(item);
}

function toCandidates(
  items: DmmItem[],
  source: ImportCandidateSource,
  sourceLabel: string,
  limit: number,
): ImportCandidate[] {
  return items.slice(0, limit).map((item) => ({
    source,
    sourceLabel,
    item,
  }));
}

export async function getImportCandidates(): Promise<ImportCandidatesResult> {
  if (!isDmmConfigured()) {
    return {
      newWorks: [],
      randomWorks: [],
      totalCount: 0,
      configured: false,
      message: "DMM API の認証情報が未設定です（DMM_API_ID / DMM_AFFILIATE_ID）。",
    };
  }

  const existingIds = getExistingContentIds();
  const usedIds = new Set(existingIds);

  const [newResponse, rankResponse] = await Promise.all([
    fetchDmmItemList({
      sort: "date",
      hits: FETCH_HITS,
      offset: 1,
      cache: "no-store",
    }),
    fetchDmmItemList({
      sort: "rank",
      hits: FETCH_HITS,
      offset: 1,
      cache: "no-store",
    }),
  ]);

  const newPool = newResponse.result.items.filter((item) =>
    isUnlistedCandidate(item, usedIds),
  );
  const newWorks = toCandidates(newPool, "new", "FANZA新作", NEW_TARGET);
  for (const candidate of newWorks) {
    usedIds.add(candidate.item.content_id);
  }

  const randomPool = shuffleItems(
    rankResponse.result.items.filter((item) => isUnlistedCandidate(item, usedIds)),
  );
  const randomWorks = toCandidates(
    randomPool,
    "random",
    "未掲載ランダム",
    RANDOM_TARGET,
  );

  const totalCount = newWorks.length + randomWorks.length;
  let message: string | undefined;

  if (totalCount === 0) {
    message = "未掲載の候補作品が見つかりませんでした。";
  } else if (
    newWorks.length < NEW_TARGET ||
    randomWorks.length < RANDOM_TARGET
  ) {
    message = `候補 ${totalCount} 件を取得しました（新作 ${newWorks.length} 件 / 未掲載ランダム ${randomWorks.length} 件）。`;
  }

  return {
    newWorks,
    randomWorks,
    totalCount,
    configured: true,
    message,
  };
}
