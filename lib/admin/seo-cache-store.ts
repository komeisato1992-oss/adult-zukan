import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  createEmptySeoCache,
  parseSeoCacheJson,
  serializeSeoCache,
  SeoCacheJsonError,
} from "@/lib/admin/seo-cache-json";
import type { SeoCachePayload } from "@/lib/admin/seo-types";
import { toGoogleSearchConsoleErrorMessage } from "@/lib/admin/google-search-console-errors";
import { getSiteUrl } from "@/lib/constants";

const ADMIN_DATA_DIR = path.join(process.cwd(), "data", "admin");
const SEO_CACHE_FILE = path.join(ADMIN_DATA_DIR, "seo-cache.json");

export function readSeoCacheLocal(): SeoCachePayload {
  if (!existsSync(SEO_CACHE_FILE)) {
    return createEmptySeoCache(getSiteUrl());
  }

  try {
    return parseSeoCacheJson(readFileSync(SEO_CACHE_FILE, "utf-8"));
  } catch (error) {
    if (error instanceof SeoCacheJsonError) {
      throw error;
    }
    return createEmptySeoCache(getSiteUrl());
  }
}

export function writeSeoCacheLocal(payload: SeoCachePayload): void {
  mkdirSync(ADMIN_DATA_DIR, { recursive: true });
  writeFileSync(SEO_CACHE_FILE, serializeSeoCache(payload), "utf-8");
}

export async function loadSeoCache(): Promise<SeoCachePayload> {
  return readSeoCacheLocal();
}

export async function saveSeoCache(payload: SeoCachePayload): Promise<void> {
  writeSeoCacheLocal(payload);
}

export function toSeoCacheStoreErrorMessage(error: unknown): {
  message: string;
  status: number;
} {
  const gscError = toGoogleSearchConsoleErrorMessage(error);
  if (gscError.code) {
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
