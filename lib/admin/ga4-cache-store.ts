import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { isGitHubProductionConfigured, getGitHubProductionConfig } from "@/lib/admin/github-config";
import type { Ga4CachePayload } from "@/lib/admin/ga4-types";
import { createEmptyGa4Cache } from "@/lib/admin/ga4-types";

const ADMIN_DATA_DIR = path.join(process.cwd(), "data", "admin");
const GA4_CACHE_FILE = path.join(ADMIN_DATA_DIR, "ga4-cache.json");
const GA4_CACHE_GITHUB_PATH = "data/admin/ga4-cache.json";
const GITHUB_API_VERSION = "2022-11-28";

type MemoryStore = typeof globalThis & {
  __ga4CachePayload?: Ga4CachePayload | null;
  __ga4CacheSha?: string | null;
};

function memory(): MemoryStore {
  return globalThis as MemoryStore;
}

function writeLocalSafe(payload: Ga4CachePayload): void {
  try {
    mkdirSync(ADMIN_DATA_DIR, { recursive: true });
    writeFileSync(GA4_CACHE_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  } catch {
    // Vercel read-only FS
  }
}

function readLocal(): Ga4CachePayload | null {
  if (!existsSync(GA4_CACHE_FILE)) return null;
  try {
    const parsed = JSON.parse(readFileSync(GA4_CACHE_FILE, "utf-8")) as Ga4CachePayload;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
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
    throw new Error(`GitHub GA4 cache error: HTTP ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function loadGa4CachePersisted(): Promise<Ga4CachePayload> {
  const store = memory();
  if (store.__ga4CachePayload?.updatedAt || store.__ga4CachePayload?.lastSuccessfulAt) {
    return store.__ga4CachePayload;
  }

  const normalize = (parsed: Ga4CachePayload): Ga4CachePayload => ({
    ...createEmptyGa4Cache({
      configured: parsed.configured,
      propertyId: parsed.propertyId,
    }),
    ...parsed,
    version: 3,
    lastSuccessfulAt:
      parsed.lastSuccessfulAt ??
      (parsed.connectionStatus === "connected" ? parsed.updatedAt : null),
  });

  if (isGitHubProductionConfigured()) {
    try {
      const config = getGitHubProductionConfig()!;
      const data = await githubRequest<{ content: string; sha: string }>(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${GA4_CACHE_GITHUB_PATH}?ref=${encodeURIComponent(config.branch)}`,
      );
      const parsed = normalize(
        JSON.parse(
          Buffer.from(data.content, "base64").toString("utf-8"),
        ) as Ga4CachePayload,
      );
      store.__ga4CachePayload = parsed;
      store.__ga4CacheSha = data.sha;
      return parsed;
    } catch (error) {
      if (!(error instanceof Error && (error as Error & { status?: number }).status === 404)) {
        // fall through to local
      }
    }
  }

  const local = readLocal();
  if (local) {
    const parsed = normalize(local);
    store.__ga4CachePayload = parsed;
    return parsed;
  }

  const empty = createEmptyGa4Cache({ configured: false, propertyId: null });
  store.__ga4CachePayload = empty;
  return empty;
}

export async function saveGa4CachePersisted(
  payload: Ga4CachePayload,
): Promise<void> {
  const store = memory();
  store.__ga4CachePayload = payload;
  writeLocalSafe(payload);

  if (!isGitHubProductionConfigured()) return;

  try {
    const config = getGitHubProductionConfig()!;
    const body: Record<string, string> = {
      message: `Update GA4 analytics cache (${payload.updatedAt ?? "partial"})`,
      content: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf-8").toString(
        "base64",
      ),
      branch: config.branch,
    };
    if (store.__ga4CacheSha) body.sha = store.__ga4CacheSha;

    await githubRequest(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${GA4_CACHE_GITHUB_PATH}`,
      { method: "PUT", body: JSON.stringify(body) },
    );
    store.__ga4CacheSha = null;
  } catch {
    // Keep memory/local even if GitHub commit fails
  }
}

export function getGa4MemoryCache(): Ga4CachePayload | null {
  return memory().__ga4CachePayload ?? null;
}

export function setGa4MemoryCache(payload: Ga4CachePayload): void {
  memory().__ga4CachePayload = payload;
}
