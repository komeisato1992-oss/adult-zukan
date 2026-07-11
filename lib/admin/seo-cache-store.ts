import "server-only";

import { createEmptySeoCache } from "@/lib/admin/seo-cache-json";
import type { SeoCachePayload } from "@/lib/admin/seo-types";
import { SeoCacheJsonError } from "@/lib/admin/seo-cache-json";
import { toGoogleSearchConsoleErrorMessage } from "@/lib/admin/google-search-console-errors";
import { getSiteUrl } from "@/lib/constants";

type SeoMemoryStore = typeof globalThis & {
  __seoMemoryCache?: SeoCachePayload | null;
};

function getMemoryStore(): SeoMemoryStore {
  return globalThis as SeoMemoryStore;
}

/** Production / Vercel 含め常にメモリキャッシュのみ使用 */
export function getSeoCacheBackend(): "memory" {
  return "memory";
}

export async function loadSeoCache(): Promise<SeoCachePayload> {
  const store = getMemoryStore();
  if (store.__seoMemoryCache) {
    return store.__seoMemoryCache;
  }

  const empty = createEmptySeoCache(getSiteUrl());
  store.__seoMemoryCache = empty;
  return empty;
}

export async function saveSeoCache(payload: SeoCachePayload): Promise<void> {
  const store = getMemoryStore();
  store.__seoMemoryCache = payload;
}

export function toSeoCacheStoreErrorMessage(error: unknown): {
  message: string;
  status: number;
  code?: string;
  apiMethod?: string;
  googleStatus?: string;
  googleErrors?: Array<{ message?: string; domain?: string; reason?: string }>;
} {
  const gscError = toGoogleSearchConsoleErrorMessage(error);
  if (gscError.code || gscError.apiMethod) {
    return gscError;
  }

  if (error instanceof SeoCacheJsonError) {
    return { message: error.message, status: error.status };
  }

  if (error instanceof Error) {
    return { message: error.message, status: 500 };
  }

  return { message: "SEOキャッシュの更新に失敗しました。", status: 500 };
}
