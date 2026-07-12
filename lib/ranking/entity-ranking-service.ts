import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getSharedCatalogWorks } from "@/lib/dmm/home-sections";
import {
  computePopularActresses,
  computePopularMakers,
  computePopularSeries,
  type EntityRankingType,
  type RankedActressEntity,
  type RankedMakerEntity,
  type RankedSeriesEntity,
} from "@/lib/ranking/entity-ranking";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_RELATIVE = "data/dmm/entity-ranking-cache.json";
const CACHE_LIMIT = 100;

type CachePayload = {
  updatedAt: string;
  actresses: RankedActressEntity[];
  makers: RankedMakerEntity[];
  series: RankedSeriesEntity[];
};

type MemoryStore = typeof globalThis & {
  __entityRankingCache?: CachePayload | null;
};

function memory(): MemoryStore {
  return globalThis as MemoryStore;
}

function cachePath(): string {
  return path.join(process.cwd(), CACHE_RELATIVE);
}

function isFresh(updatedAt: string): boolean {
  const ts = Date.parse(updatedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < CACHE_TTL_MS;
}

function readLocalCache(): CachePayload | null {
  try {
    if (!existsSync(cachePath())) return null;
    const parsed = JSON.parse(readFileSync(cachePath(), "utf-8")) as CachePayload;
    if (!parsed?.updatedAt || !Array.isArray(parsed.actresses)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(payload: CachePayload): void {
  try {
    mkdirSync(path.dirname(cachePath()), { recursive: true });
    writeFileSync(cachePath(), `${JSON.stringify(payload)}\n`, "utf-8");
  } catch {
    // Vercel read-only FS
  }
}

export function clearEntityRankingCache(): void {
  memory().__entityRankingCache = null;
  try {
    if (existsSync(cachePath())) {
      writeFileSync(
        cachePath(),
        `${JSON.stringify({ updatedAt: "", actresses: [], makers: [], series: [] })}\n`,
        "utf-8",
      );
    }
  } catch {
    // ignore
  }
}

async function rebuildCache(): Promise<CachePayload> {
  const started = Date.now();
  const catalog = await getSharedCatalogWorks();
  const payload: CachePayload = {
    updatedAt: new Date().toISOString(),
    actresses: computePopularActresses(catalog, CACHE_LIMIT),
    makers: computePopularMakers(catalog, CACHE_LIMIT),
    series: computePopularSeries(catalog, CACHE_LIMIT),
  };
  memory().__entityRankingCache = payload;
  writeLocalCache(payload);
  console.info("[entity-ranking] rebuilt", {
    durationMs: Date.now() - started,
    actresses: payload.actresses.length,
    makers: payload.makers.length,
    series: payload.series.length,
    fromCache: false,
  });
  return payload;
}

async function loadCache(force = false): Promise<{
  payload: CachePayload;
  fromCache: boolean;
}> {
  if (!force) {
    const mem = memory().__entityRankingCache;
    if (mem && isFresh(mem.updatedAt)) {
      return { payload: mem, fromCache: true };
    }
    const local = readLocalCache();
    if (local && isFresh(local.updatedAt)) {
      memory().__entityRankingCache = local;
      return { payload: local, fromCache: true };
    }
  }

  const payload = await rebuildCache();
  return { payload, fromCache: false };
}

export async function getPopularActresses(
  limit = 30,
): Promise<{
  items: RankedActressEntity[];
  fromCache: boolean;
  generatedAt: string;
  durationMs: number;
  error?: string;
}> {
  const started = Date.now();
  try {
    const { payload, fromCache } = await loadCache();
    const items = payload.actresses
      .filter((row) => row.workCount >= 1)
      .slice(0, limit);
    return {
      items,
      fromCache,
      generatedAt: payload.updatedAt,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[entity-ranking] actress failed", {
      entityType: "actress",
      error: message,
      durationMs: Date.now() - started,
      fromCache: false,
      count: 0,
    });
    return {
      items: [],
      fromCache: false,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      error: message,
    };
  }
}

export async function getPopularMakers(
  limit = 30,
): Promise<{
  items: RankedMakerEntity[];
  fromCache: boolean;
  generatedAt: string;
  durationMs: number;
  error?: string;
}> {
  const started = Date.now();
  try {
    const { payload, fromCache } = await loadCache();
    const items = payload.makers
      .filter((row) => row.workCount >= 1)
      .slice(0, limit);
    return {
      items,
      fromCache,
      generatedAt: payload.updatedAt,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[entity-ranking] maker failed", {
      entityType: "maker",
      error: message,
      durationMs: Date.now() - started,
      fromCache: false,
      count: 0,
    });
    return {
      items: [],
      fromCache: false,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      error: message,
    };
  }
}

export async function getPopularSeries(
  limit = 30,
): Promise<{
  items: RankedSeriesEntity[];
  fromCache: boolean;
  generatedAt: string;
  durationMs: number;
  error?: string;
}> {
  const started = Date.now();
  try {
    const { payload, fromCache } = await loadCache();
    const items = payload.series
      .filter((row) => row.workCount >= 1)
      .slice(0, limit);
    return {
      items,
      fromCache,
      generatedAt: payload.updatedAt,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[entity-ranking] series failed", {
      entityType: "series",
      error: message,
      durationMs: Date.now() - started,
      fromCache: false,
      count: 0,
    });
    return {
      items: [],
      fromCache: false,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      error: message,
    };
  }
}

export async function getEntityRanking(input: {
  entityType: EntityRankingType;
  limit?: number;
}) {
  const limit = input.limit ?? 30;
  if (input.entityType === "actress") return getPopularActresses(limit);
  if (input.entityType === "maker") return getPopularMakers(limit);
  return getPopularSeries(limit);
}

export async function refreshEntityRankingCache(): Promise<CachePayload> {
  clearEntityRankingCache();
  const { payload } = await loadCache(true);
  return payload;
}
