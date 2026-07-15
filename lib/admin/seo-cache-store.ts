import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  pickFreshestByUpdatedAt,
} from "@/lib/admin/cache-freshness";
import {
  createEmptySeoCache,
  parseSeoCacheJson,
  serializeSeoCache,
  SeoCacheJsonError,
} from "@/lib/admin/seo-cache-json";
import type { SeoCachePayload } from "@/lib/admin/seo-types";
import { toGoogleSearchConsoleErrorMessage } from "@/lib/admin/google-search-console-errors";
import { getSiteUrl } from "@/lib/constants";
import {
  getGitHubProductionConfig,
  isGitHubProductionConfigured,
} from "@/lib/admin/github-config";

const ADMIN_DATA_DIR = path.join(process.cwd(), "data", "admin");
/** 正本キャッシュ（gitignore 済み） */
const SEO_CACHE_FILE = path.join(ADMIN_DATA_DIR, "seo-cache.json");
/** 互換読み込み用（過去の想定パス） */
const SEO_CACHE_LEGACY_FILE = path.join(
  ADMIN_DATA_DIR,
  "search-console-cache.json",
);
const SEO_CACHE_GITHUB_PATH = "data/admin/seo-cache.json";
const GITHUB_API_VERSION = "2022-11-28";

type SeoMemoryStore = typeof globalThis & {
  __seoMemoryCache?: SeoCachePayload | null;
  __seoMemoryCacheSha?: string | null;
};

function getMemoryStore(): SeoMemoryStore {
  return globalThis as SeoMemoryStore;
}

function hasPersistedSeoData(payload: SeoCachePayload | null | undefined): boolean {
  return Boolean(payload?.updatedAt);
}

export function getSeoCacheBackend(): "github" | "local" | "memory" {
  if (isGitHubProductionConfigured()) return "github";
  return "local";
}

function writeLocalSafe(payload: SeoCachePayload): void {
  try {
    mkdirSync(ADMIN_DATA_DIR, { recursive: true });
    writeFileSync(SEO_CACHE_FILE, serializeSeoCache(payload), "utf-8");
  } catch {
    // Vercel 等の読み取り専用 FS では無視（メモリ / GitHub が正）
  }
}

function readLocalFile(filePath: string): SeoCachePayload | null {
  if (!existsSync(filePath)) return null;
  try {
    return parseSeoCacheJson(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function readLocal(): SeoCachePayload | null {
  return readLocalFile(SEO_CACHE_FILE) ?? readLocalFile(SEO_CACHE_LEGACY_FILE);
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const config = getGitHubProductionConfig();
  if (!config) throw new Error("GitHub未設定");

  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const error = new Error("not_found");
      (error as Error & { status: number }).status = 404;
      throw error;
    }
    throw new Error(`GitHub SEO cache error: HTTP ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

/**
 * 表示時は API を呼ばずキャッシュを読む。
 * GitHub 正本がある場合は memory と GitHub の新しい方を採用し、
 * 他インスタンスが更新した最新値で上書きできるようにする。
 */
export async function loadSeoCache(): Promise<SeoCachePayload> {
  const store = getMemoryStore();
  const memory = hasPersistedSeoData(store.__seoMemoryCache)
    ? store.__seoMemoryCache!
    : null;

  let remote: SeoCachePayload | null = null;
  if (isGitHubProductionConfigured()) {
    try {
      const config = getGitHubProductionConfig()!;
      const data = await githubRequest<{ content: string; sha: string }>(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${SEO_CACHE_GITHUB_PATH}?ref=${encodeURIComponent(config.branch)}`,
      );
      remote = parseSeoCacheJson(
        Buffer.from(data.content, "base64").toString("utf-8"),
      );
      store.__seoMemoryCacheSha = data.sha;
    } catch (error) {
      if (!(error instanceof Error && (error as Error & { status?: number }).status === 404)) {
        // fall through
      }
    }
  }

  const local = readLocal();
  const best = pickFreshestByUpdatedAt([memory, remote, local]);
  if (best && hasPersistedSeoData(best)) {
    store.__seoMemoryCache = best;
    return best;
  }

  const empty = createEmptySeoCache(getSiteUrl());
  store.__seoMemoryCache = empty;
  return empty;
}

/** 更新ボタン / Cron 成功後にメモリ + ローカル + GitHub へ保存 */
export async function saveSeoCache(payload: SeoCachePayload): Promise<void> {
  const store = getMemoryStore();
  store.__seoMemoryCache = payload;
  writeLocalSafe(payload);

  if (!isGitHubProductionConfigured()) return;

  try {
    const config = getGitHubProductionConfig()!;
    const body: Record<string, string> = {
      message: `Update Search Console cache (${payload.updatedAt ?? "partial"})`,
      content: Buffer.from(serializeSeoCache(payload), "utf-8").toString("base64"),
      branch: config.branch,
    };
    if (store.__seoMemoryCacheSha) body.sha = store.__seoMemoryCacheSha;

    await githubRequest(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${SEO_CACHE_GITHUB_PATH}`,
      { method: "PUT", body: JSON.stringify(body) },
    );
    store.__seoMemoryCacheSha = null;
  } catch {
    // Keep memory/local even if GitHub commit fails
  }
}

export function getSeoMemoryCache(): SeoCachePayload | null {
  return getMemoryStore().__seoMemoryCache ?? null;
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
