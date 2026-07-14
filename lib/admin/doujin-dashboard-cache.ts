import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { DoujinAdminDashboardStats } from "@/lib/admin/doujin-admin-stats";
import type { DoujinAnalyticsSnapshot } from "@/lib/admin/doujin-analytics";

const ADMIN_DATA_DIR = path.join(process.cwd(), "data", "admin");
const CACHE_FILE = path.join(ADMIN_DATA_DIR, "doujin-dashboard-cache.json");

export type DoujinDashboardCachePayload = {
  siteType: "doujin";
  version: 1;
  updatedAt: string;
  stats: DoujinAdminDashboardStats | null;
  analytics: DoujinAnalyticsSnapshot | null;
};

type MemoryStore = typeof globalThis & {
  __doujinDashboardCache?: DoujinDashboardCachePayload | null;
};

function memory(): MemoryStore {
  return globalThis as MemoryStore;
}

function writeLocalSafe(payload: DoujinDashboardCachePayload): void {
  try {
    mkdirSync(ADMIN_DATA_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  } catch {
    // Vercel read-only FS — memory cache still works for the process
  }
}

function readLocal(): DoujinDashboardCachePayload | null {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    const parsed = JSON.parse(
      readFileSync(CACHE_FILE, "utf-8"),
    ) as DoujinDashboardCachePayload;
    if (!parsed || parsed.siteType !== "doujin") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadDoujinDashboardCache(): DoujinDashboardCachePayload | null {
  const store = memory();
  if (store.__doujinDashboardCache?.siteType === "doujin") {
    return store.__doujinDashboardCache;
  }
  const local = readLocal();
  if (local) {
    store.__doujinDashboardCache = local;
    return local;
  }
  return null;
}

export function saveDoujinDashboardCache(
  payload: Omit<DoujinDashboardCachePayload, "siteType" | "version" | "updatedAt"> & {
    updatedAt?: string;
  },
): DoujinDashboardCachePayload {
  const next: DoujinDashboardCachePayload = {
    siteType: "doujin",
    version: 1,
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
    stats: payload.stats,
    analytics: payload.analytics,
  };
  memory().__doujinDashboardCache = next;
  writeLocalSafe(next);
  return next;
}
