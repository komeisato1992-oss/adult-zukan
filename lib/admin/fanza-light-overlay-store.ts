import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { parseCacheTimestamp } from "@/lib/admin/cache-freshness";
import {
  isGitHubCatalogConfigured,
  getGitHubConfig,
} from "@/lib/admin/github-config";
import { pickAdultSyncFields } from "@/lib/dmm/sync-diff";
import type { AdultSyncMode } from "@/lib/dmm/sync-mode";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import type { DmmItem } from "@/lib/dmm/types";

export const FANZA_LIGHT_OVERLAY_RELATIVE_PATH =
  "data/dmm/fanza-light-overlay.json";

export type FanzaLightOverlayEntry = Partial<DmmItem> & {
  contentId: string;
  updatedAt: string;
};

export type FanzaLightOverlayFile = {
  version: 1;
  updatedAt: string | null;
  entries: Record<string, FanzaLightOverlayEntry>;
};

const GITHUB_API_VERSION = "2022-11-28";

type MemoryStore = typeof globalThis & {
  __fanzaLightOverlay?: FanzaLightOverlayFile | null;
  __fanzaLightOverlaySha?: string | null;
};

function getMemoryStore(): MemoryStore {
  return globalThis as MemoryStore;
}

function absolutePath(): string {
  return path.join(process.cwd(), FANZA_LIGHT_OVERLAY_RELATIVE_PATH);
}

function emptyOverlay(): FanzaLightOverlayFile {
  return { version: 1, updatedAt: null, entries: {} };
}

function parseOverlay(raw: unknown): FanzaLightOverlayFile {
  if (!raw || typeof raw !== "object") return emptyOverlay();
  const obj = raw as Partial<FanzaLightOverlayFile>;
  const entries: Record<string, FanzaLightOverlayEntry> = {};
  if (obj.entries && typeof obj.entries === "object") {
    for (const [key, value] of Object.entries(obj.entries)) {
      if (!value || typeof value !== "object") continue;
      const cid = normalizeCatalogContentId(
        (value as FanzaLightOverlayEntry).contentId || key,
      );
      if (!cid) continue;
      entries[cid] = {
        ...(value as FanzaLightOverlayEntry),
        contentId: cid,
        updatedAt:
          typeof (value as FanzaLightOverlayEntry).updatedAt === "string"
            ? (value as FanzaLightOverlayEntry).updatedAt
            : new Date().toISOString(),
      };
    }
  }
  return {
    version: 1,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : null,
    entries,
  };
}

function readLocalOverlay(): FanzaLightOverlayFile | null {
  const filePath = absolutePath();
  if (!existsSync(filePath)) return null;
  try {
    return parseOverlay(JSON.parse(readFileSync(filePath, "utf8")));
  } catch {
    return null;
  }
}

function writeLocalOverlay(overlay: FanzaLightOverlayFile): void {
  try {
    mkdirSync(path.dirname(absolutePath()), { recursive: true });
    writeFileSync(
      absolutePath(),
      `${JSON.stringify(overlay, null, 2)}\n`,
      "utf8",
    );
  } catch {
    // read-only FS (Vercel) — memory / GitHub が正
  }
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const config = getGitHubConfig();
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
    throw new Error(`GitHub overlay error: HTTP ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

function pickFreshestOverlay(
  candidates: Array<FanzaLightOverlayFile | null | undefined>,
): FanzaLightOverlayFile {
  let best = emptyOverlay();
  let bestTs = -1;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const ts = parseCacheTimestamp(candidate.updatedAt);
    if (ts > bestTs) {
      best = candidate;
      bestTs = ts;
    }
  }
  return best;
}

/** 軽量同期の永続化（カタログJSONは触らない） */
export async function loadFanzaLightOverlay(): Promise<FanzaLightOverlayFile> {
  const store = getMemoryStore();
  const memory = store.__fanzaLightOverlay ?? null;
  let remote: FanzaLightOverlayFile | null = null;

  if (isGitHubCatalogConfigured()) {
    try {
      const config = getGitHubConfig()!;
      const data = await githubRequest<{ content: string; sha: string }>(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${FANZA_LIGHT_OVERLAY_RELATIVE_PATH}?ref=${encodeURIComponent(config.branch)}`,
      );
      remote = parseOverlay(
        JSON.parse(Buffer.from(data.content, "base64").toString("utf-8")),
      );
      store.__fanzaLightOverlaySha = data.sha;
    } catch (error) {
      if (!(error instanceof Error && (error as Error & { status?: number }).status === 404)) {
        // fall through
      }
    }
  }

  const local = readLocalOverlay();
  const best = pickFreshestOverlay([memory, remote, local]);
  store.__fanzaLightOverlay = best;
  return best;
}

export async function saveFanzaLightOverlay(
  overlay: FanzaLightOverlayFile,
): Promise<void> {
  const store = getMemoryStore();
  store.__fanzaLightOverlay = overlay;
  writeLocalOverlay(overlay);

  if (!isGitHubCatalogConfigured()) return;

  try {
    const config = getGitHubConfig()!;
    const body: Record<string, string> = {
      message: `Update light sync overlay (${overlay.updatedAt ?? "partial"})`,
      content: Buffer.from(`${JSON.stringify(overlay, null, 2)}\n`, "utf-8").toString(
        "base64",
      ),
      branch: config.branch,
    };
    if (store.__fanzaLightOverlaySha) body.sha = store.__fanzaLightOverlaySha;

    await githubRequest(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${FANZA_LIGHT_OVERLAY_RELATIVE_PATH}`,
      { method: "PUT", body: JSON.stringify(body) },
    );
    store.__fanzaLightOverlaySha = null;
  } catch {
    // Keep memory/local even if GitHub commit fails
  }
}

/** 同期結果をオーバーレイへ反映（カタログ本体は変更しない） */
export async function upsertLightOverlayFromWorks(
  works: DmmItem[],
  mode: AdultSyncMode,
): Promise<{ updated: number }> {
  const overlay = await loadFanzaLightOverlay();
  const now = new Date().toISOString();
  let updated = 0;

  for (const work of works) {
    const contentId = normalizeCatalogContentId(work.content_id);
    if (!contentId) continue;
    const patch = pickAdultSyncFields(work, mode);
    overlay.entries[contentId] = {
      ...overlay.entries[contentId],
      ...patch,
      contentId,
      updatedAt: now,
    };
    updated += 1;
  }

  if (updated > 0) {
    overlay.updatedAt = now;
    await saveFanzaLightOverlay(overlay);
    const { invalidateDmmStaticWorksCache } = await import(
      "@/lib/dmm/static-works"
    );
    invalidateDmmStaticWorksCache();
  }

  return { updated };
}

export function applyLightOverlayToItems(
  items: DmmItem[],
  overlay: FanzaLightOverlayFile,
): DmmItem[] {
  if (!overlay.updatedAt && Object.keys(overlay.entries).length === 0) {
    return items;
  }

  return items.map((item) => {
    const contentId = normalizeCatalogContentId(item.content_id);
    const entry = overlay.entries[contentId];
    if (!entry) return item;
    const { contentId: _c, updatedAt: _u, ...fields } = entry;
    return { ...item, ...fields };
  });
}

export async function mergeLightOverlayIntoItems(
  items: DmmItem[],
): Promise<DmmItem[]> {
  const overlay = await loadFanzaLightOverlay();
  return applyLightOverlayToItems(items, overlay);
}

/** オーバーレイをカタログ配列へ焼き込む（ファイルは消さない） */
export async function applyLoadedOverlayToItems(
  items: DmmItem[],
): Promise<{ items: DmmItem[]; flushedCount: number }> {
  const overlay = await loadFanzaLightOverlay();
  const entries = Object.keys(overlay.entries);
  if (entries.length === 0) {
    return { items, flushedCount: 0 };
  }
  return {
    items: applyLightOverlayToItems(items, overlay),
    flushedCount: entries.length,
  };
}

export async function clearFanzaLightOverlay(): Promise<void> {
  await saveFanzaLightOverlay(emptyOverlay());
  const { invalidateDmmStaticWorksCache } = await import(
    "@/lib/dmm/static-works"
  );
  invalidateDmmStaticWorksCache();
}
