import { buildWorkIdentityKeys } from "@/lib/admin/import-identity";
import type { DmmItem } from "@/lib/dmm/types";

export type ImportFetchedHistory = {
  contentIds: string[];
  productIds: string[];
  productCodes: string[];
  urls: string[];
  titles: string[];
  lastUpdatedAt: string | null;
  lastRunAt: string | null;
  lastApiFetchedCount: number;
  lastAddedCount: number;
  lastSkippedExistingCount: number;
  lastExcludedCount: number;
  lastFailedCount: number;
};

export function createEmptyFetchedHistory(): ImportFetchedHistory {
  return {
    contentIds: [],
    productIds: [],
    productCodes: [],
    urls: [],
    titles: [],
    lastUpdatedAt: null,
    lastRunAt: null,
    lastApiFetchedCount: 0,
    lastAddedCount: 0,
    lastSkippedExistingCount: 0,
    lastExcludedCount: 0,
    lastFailedCount: 0,
  };
}

export function parseFetchedHistory(raw: unknown): ImportFetchedHistory {
  const defaults = createEmptyFetchedHistory();
  if (!raw || typeof raw !== "object") return defaults;

  const value = raw as Record<string, unknown>;
  const readStringArray = (key: string): string[] =>
    Array.isArray(value[key])
      ? (value[key] as unknown[]).filter(
          (entry): entry is string => typeof entry === "string" && entry.length > 0,
        )
      : defaults[key as keyof ImportFetchedHistory] as string[];

  return {
    contentIds: readStringArray("contentIds"),
    productIds: readStringArray("productIds"),
    productCodes: readStringArray("productCodes"),
    urls: readStringArray("urls"),
    titles: readStringArray("titles"),
    lastUpdatedAt:
      typeof value.lastUpdatedAt === "string" ? value.lastUpdatedAt : null,
    lastRunAt: typeof value.lastRunAt === "string" ? value.lastRunAt : null,
    lastApiFetchedCount:
      typeof value.lastApiFetchedCount === "number"
        ? Math.max(0, Math.floor(value.lastApiFetchedCount))
        : 0,
    lastAddedCount:
      typeof value.lastAddedCount === "number"
        ? Math.max(0, Math.floor(value.lastAddedCount))
        : 0,
    lastSkippedExistingCount:
      typeof value.lastSkippedExistingCount === "number"
        ? Math.max(0, Math.floor(value.lastSkippedExistingCount))
        : 0,
    lastExcludedCount:
      typeof value.lastExcludedCount === "number"
        ? Math.max(0, Math.floor(value.lastExcludedCount))
        : 0,
    lastFailedCount:
      typeof value.lastFailedCount === "number"
        ? Math.max(0, Math.floor(value.lastFailedCount))
        : 0,
  };
}

export function serializeFetchedHistory(history: ImportFetchedHistory): string {
  return `${JSON.stringify(history, null, 2)}\n`;
}

export function buildFetchedHistoryKeySet(
  history: ImportFetchedHistory,
): Set<string> {
  const keys = new Set<string>();

  for (const id of history.contentIds) keys.add(`cid:${id}`);
  for (const id of history.productIds) keys.add(`pid:${id}`);
  for (const code of history.productCodes) keys.add(`code:${code}`);
  for (const url of history.urls) keys.add(`url:${url}`);
  for (const title of history.titles) keys.add(`title:${title}`);

  return keys;
}

export function mergeItemsIntoFetchedHistory(
  history: ImportFetchedHistory,
  items: DmmItem[],
): ImportFetchedHistory {
  const contentIds = new Set(history.contentIds);
  const productIds = new Set(history.productIds);
  const productCodes = new Set(history.productCodes);
  const urls = new Set(history.urls);
  const titles = new Set(history.titles);

  for (const item of items) {
    const identity = buildWorkIdentityKeys(item);
    if (identity.contentId) contentIds.add(identity.contentId);
    if (identity.productId) productIds.add(identity.productId);
    if (identity.productCode) productCodes.add(identity.productCode);
    if (identity.url) urls.add(identity.url);
    if (identity.title) titles.add(identity.title);
  }

  return {
    ...history,
    contentIds: [...contentIds],
    productIds: [...productIds],
    productCodes: [...productCodes],
    urls: [...urls],
    titles: [...titles],
    lastUpdatedAt: new Date().toISOString(),
  };
}
