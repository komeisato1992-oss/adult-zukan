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

export type SeoCacheSaveResult = {
  backend: "github" | "local";
  absolutePath: string;
  updatedAt: string | null;
  pages28: number;
  indexedPages: number | null;
};

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

function isReadOnlyFsError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  return (
    code === "EROFS" ||
    code === "EACCES" ||
    code === "EPERM" ||
    /read-only|erofs|permission denied/i.test(
      error instanceof Error ? error.message : String(error),
    )
  );
}

export function getSeoCacheAbsolutePath(): string {
  return SEO_CACHE_FILE;
}

export function getSeoCacheBackend(): "github" | "local" | "memory" {
  if (isGitHubProductionConfigured()) return "github";
  return "local";
}

function writeLocal(payload: SeoCachePayload): void {
  mkdirSync(ADMIN_DATA_DIR, { recursive: true });
  writeFileSync(SEO_CACHE_FILE, serializeSeoCache(payload), "utf-8");
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
    const body = await response.text().catch(() => "");
    throw new Error(
      `GitHub SEO cache error: HTTP ${response.status}${body ? ` ${body.slice(0, 300)}` : ""}`,
    );
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

/**
 * 更新成功時のみ呼ぶ。永続化に失敗したら例外を投げ、呼び出し元は成功扱いにしないこと。
 */
export async function saveSeoCache(
  payload: SeoCachePayload,
): Promise<SeoCacheSaveResult> {
  const store = getMemoryStore();
  store.__seoMemoryCache = payload;

  const githubConfigured = isGitHubProductionConfigured();
  let localOk = false;

  try {
    writeLocal(payload);
    localOk = true;
  } catch (error) {
    if (githubConfigured && isReadOnlyFsError(error)) {
      console.warn("[seo-cache] local FS is read-only; relying on GitHub", {
        path: SEO_CACHE_FILE,
        message: error instanceof Error ? error.message : String(error),
      });
    } else if (!githubConfigured) {
      throw new Error(
        `SEOキャッシュのローカル保存に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        } (${SEO_CACHE_FILE})`,
      );
    } else {
      throw new Error(
        `SEOキャッシュのローカル保存に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        } (${SEO_CACHE_FILE})`,
      );
    }
  }

  if (githubConfigured) {
    try {
      const config = getGitHubProductionConfig()!;
      const body: Record<string, string> = {
        message: `Update Search Console cache (${payload.updatedAt ?? "partial"})`,
        content: Buffer.from(serializeSeoCache(payload), "utf-8").toString(
          "base64",
        ),
        branch: config.branch,
      };
      if (store.__seoMemoryCacheSha) body.sha = store.__seoMemoryCacheSha;

      await githubRequest(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${SEO_CACHE_GITHUB_PATH}`,
        { method: "PUT", body: JSON.stringify(body) },
      );
      store.__seoMemoryCacheSha = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[seo-cache] GitHub save failed", {
        message,
        updatedAt: payload.updatedAt,
        pages28: payload.periods?.[28]?.pages?.length ?? 0,
        indexedPages: payload.index?.indexedPages ?? null,
      });
      throw new Error(`SEOキャッシュのGitHub保存に失敗しました: ${message}`);
    }
  } else if (!localOk) {
    throw new Error(
      `SEOキャッシュを永続化できませんでした (${SEO_CACHE_FILE})`,
    );
  }

  const result: SeoCacheSaveResult = {
    backend: githubConfigured ? "github" : "local",
    absolutePath: SEO_CACHE_FILE,
    updatedAt: payload.updatedAt,
    pages28: payload.periods?.[28]?.pages?.length ?? 0,
    indexedPages: payload.index?.indexedPages ?? null,
  };
  console.info("[seo-cache] save succeeded", result);
  return result;
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
