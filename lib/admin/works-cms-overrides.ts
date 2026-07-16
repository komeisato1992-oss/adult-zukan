import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import type { FanzaTvStatusValue } from "@/lib/admin/works-cms-publish";

export const WORKS_CMS_OVERRIDES_RELATIVE_PATH =
  "data/dmm/works-cms-overrides.json";

export type WorksCmsOverride = {
  cid: string;
  manual_hidden?: boolean;
  manual_hidden_reason?: string | null;
  deleted_at?: string | null;
  fanza_tv_status?: FanzaTvStatusValue | null;
  fanza_tv_checked_at?: string | null;
  fanza_tv_changed_at?: string | null;
  fanza_tv_source?: string | null;
  fanza_tv_error?: string | null;
  updated_at?: string;
};

type FileShape = {
  version: 1;
  updatedAt: string | null;
  entries: Record<string, WorksCmsOverride>;
};

type Memory = typeof globalThis & {
  __worksCmsOverrides?: FileShape | null;
  __worksCmsSchemaV2?: boolean | null;
};

function memory(): Memory {
  return globalThis as Memory;
}

function absolutePath(): string {
  return path.join(process.cwd(), WORKS_CMS_OVERRIDES_RELATIVE_PATH);
}

function empty(): FileShape {
  return { version: 1, updatedAt: null, entries: {} };
}

function readFile(): FileShape {
  const m = memory();
  if (m.__worksCmsOverrides) return m.__worksCmsOverrides;
  const filePath = absolutePath();
  if (!existsSync(filePath)) {
    m.__worksCmsOverrides = empty();
    return m.__worksCmsOverrides;
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<FileShape>;
    const entries: Record<string, WorksCmsOverride> = {};
    if (parsed.entries && typeof parsed.entries === "object") {
      for (const [key, value] of Object.entries(parsed.entries)) {
        if (!value || typeof value !== "object") continue;
        const cid = normalizeCatalogContentId(value.cid || key);
        if (!cid) continue;
        entries[cid] = { ...value, cid };
      }
    }
    m.__worksCmsOverrides = {
      version: 1,
      updatedAt: parsed.updatedAt ?? null,
      entries,
    };
    return m.__worksCmsOverrides;
  } catch {
    m.__worksCmsOverrides = empty();
    return m.__worksCmsOverrides;
  }
}

function writeFile(file: FileShape): void {
  memory().__worksCmsOverrides = file;
  try {
    mkdirSync(path.dirname(absolutePath()), { recursive: true });
    writeFileSync(absolutePath(), `${JSON.stringify(file, null, 2)}\n`, "utf8");
  } catch {
    // read-only
  }
}

export function getWorksCmsOverride(cid: string): WorksCmsOverride | null {
  const normalized = normalizeCatalogContentId(cid);
  if (!normalized) return null;
  return readFile().entries[normalized] ?? null;
}

export function upsertWorksCmsOverrides(
  updates: WorksCmsOverride[],
): number {
  if (updates.length === 0) return 0;
  const file = readFile();
  const now = new Date().toISOString();
  let count = 0;
  for (const update of updates) {
    const cid = normalizeCatalogContentId(update.cid);
    if (!cid) continue;
    const prev = file.entries[cid] ?? { cid };
    file.entries[cid] = {
      ...prev,
      ...update,
      cid,
      updated_at: now,
    };
    count += 1;
  }
  file.updatedAt = now;
  writeFile(file);
  return count;
}

export function listWorksCmsOverrides(): WorksCmsOverride[] {
  return Object.values(readFile().entries);
}

/** Phase6 スキーマ（manual_hidden 等）が works にあるか */
export async function detectWorksCmsSchemaV2(): Promise<boolean> {
  const m = memory();
  if (typeof m.__worksCmsSchemaV2 === "boolean") return m.__worksCmsSchemaV2;
  try {
    const { getSupabaseServiceClient } = await import("@/lib/supabase/server");
    const client = getSupabaseServiceClient();
    if (!client) {
      m.__worksCmsSchemaV2 = false;
      return false;
    }
    const { error } = await client.from("works").select("manual_hidden").limit(1);
    m.__worksCmsSchemaV2 = !error;
    return m.__worksCmsSchemaV2;
  } catch {
    m.__worksCmsSchemaV2 = false;
    return false;
  }
}

export function clearWorksCmsSchemaCache(): void {
  memory().__worksCmsSchemaV2 = null;
  memory().__worksCmsOverrides = null;
}
