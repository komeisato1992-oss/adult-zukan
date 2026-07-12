import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  getGitHubConfig,
  isGitHubCatalogConfigured,
} from "@/lib/admin/github-config";

/**
 * 本番永続化は GitHub（既存の GA4/DMM と同じ方式）。
 * スキーマは actress_image_overrides テーブル相当。
 */
export type ActressImageSelectionType = "manual" | "automatic";

export type ActressImageOverride = {
  id: string;
  /** 女優キー（slug）。ユニーク */
  actress_id: string;
  /** 互換: 旧 key */
  key?: string;
  work_id: string | null;
  image_url: string | null;
  selection_type: ActressImageSelectionType;
  selected_by: string | null;
  selected_at: string;
  updated_at: string;
  note: string | null;
  /** 旧互換フィールド */
  useDefault?: boolean;
  score?: number;
  faceDetected?: boolean;
  isSoloWork?: boolean;
  imageUrl?: string;
  workId?: string | null;
};

export type ActressImageOverridesFile = {
  version: number;
  updatedAt?: string;
  overrides: ActressImageOverride[];
};

const OVERRIDES_RELATIVE = "data/dmm/actress-image-overrides.json";
const GITHUB_API_VERSION = "2022-11-28";

type MemoryStore = typeof globalThis & {
  __actressImageOverrides?: ActressImageOverridesFile | null;
  __actressImageOverridesSha?: string | null;
  __actressImageOverridesLoadPromise?: Promise<ActressImageOverridesFile> | null;
};

function memory(): MemoryStore {
  return globalThis as MemoryStore;
}

function getOverridesPath(): string {
  return path.join(process.cwd(), OVERRIDES_RELATIVE);
}

function emptyFile(): ActressImageOverridesFile {
  return { version: 2, updatedAt: undefined, overrides: [] };
}

function migrateOverride(raw: Record<string, unknown>): ActressImageOverride | null {
  const actressId =
    (typeof raw.actress_id === "string" && raw.actress_id) ||
    (typeof raw.key === "string" && raw.key) ||
    null;
  if (!actressId) return null;

  const imageUrl =
    (typeof raw.image_url === "string" && raw.image_url) ||
    (typeof raw.imageUrl === "string" && raw.imageUrl) ||
    null;
  const workId =
    (typeof raw.work_id === "string" && raw.work_id) ||
    (typeof raw.workId === "string" && raw.workId) ||
    null;
  const selectionType: ActressImageSelectionType =
    raw.selection_type === "automatic" || raw.note === "automatic"
      ? "automatic"
      : "manual";
  const now =
    (typeof raw.updated_at === "string" && raw.updated_at) ||
    (typeof raw.updatedAt === "string" && raw.updatedAt) ||
    new Date().toISOString();

  return {
    id:
      typeof raw.id === "string" && raw.id
        ? raw.id
        : `override_${actressId}`,
    actress_id: actressId,
    key: actressId,
    work_id: workId,
    image_url: imageUrl,
    selection_type: selectionType,
    selected_by:
      typeof raw.selected_by === "string" ? raw.selected_by : "admin",
    selected_at:
      (typeof raw.selected_at === "string" && raw.selected_at) || now,
    updated_at: now,
    note: typeof raw.note === "string" ? raw.note : null,
    useDefault: Boolean(raw.useDefault),
    score: typeof raw.score === "number" ? raw.score : undefined,
    faceDetected:
      typeof raw.faceDetected === "boolean" ? raw.faceDetected : undefined,
    isSoloWork:
      typeof raw.isSoloWork === "boolean" ? raw.isSoloWork : undefined,
    imageUrl: imageUrl ?? undefined,
    workId,
  };
}

function normalizeFile(raw: unknown): ActressImageOverridesFile {
  if (!raw || typeof raw !== "object") return emptyFile();
  const data = raw as Record<string, unknown>;
  const overrides = Array.isArray(data.overrides)
    ? data.overrides
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
        .map(migrateOverride)
        .filter((row): row is ActressImageOverride => Boolean(row))
    : [];
  return {
    version: Number(data.version) || 2,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    overrides,
  };
}

function readLocalFile(): ActressImageOverridesFile {
  const filePath = getOverridesPath();
  if (!existsSync(filePath)) return emptyFile();
  try {
    return normalizeFile(JSON.parse(readFileSync(filePath, "utf-8")));
  } catch {
    return emptyFile();
  }
}

function writeLocalSafe(file: ActressImageOverridesFile): void {
  try {
    mkdirSync(path.dirname(getOverridesPath()), { recursive: true });
    writeFileSync(
      getOverridesPath(),
      `${JSON.stringify(file, null, 2)}\n`,
      "utf-8",
    );
  } catch {
    // Vercel read-only FS
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
    throw new Error(`GitHub actress overrides error: HTTP ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export function clearActressImageOverrideCache(): void {
  const store = memory();
  store.__actressImageOverrides = null;
  store.__actressImageOverridesSha = null;
  store.__actressImageOverridesLoadPromise = null;
}

/** メモリ → GitHub → ローカルの順で読込（本番は GitHub 正） */
export async function ensureActressImageOverridesLoaded(): Promise<ActressImageOverridesFile> {
  const store = memory();
  if (store.__actressImageOverrides) return store.__actressImageOverrides;
  if (store.__actressImageOverridesLoadPromise) {
    return store.__actressImageOverridesLoadPromise;
  }

  store.__actressImageOverridesLoadPromise = (async () => {
    if (isGitHubCatalogConfigured()) {
      try {
        const config = getGitHubConfig()!;
        const data = await githubRequest<{ content: string; sha: string }>(
          `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${OVERRIDES_RELATIVE}?ref=${encodeURIComponent(config.branch)}`,
        );
        const parsed = normalizeFile(
          JSON.parse(Buffer.from(data.content, "base64").toString("utf-8")),
        );
        store.__actressImageOverrides = parsed;
        store.__actressImageOverridesSha = data.sha;
        writeLocalSafe(parsed);
        return parsed;
      } catch (error) {
        if (!(error instanceof Error && (error as Error & { status?: number }).status === 404)) {
          // fall through
        }
      }
    }

    const local = readLocalFile();
    store.__actressImageOverrides = local;
    return local;
  })();

  try {
    return await store.__actressImageOverridesLoadPromise;
  } finally {
    store.__actressImageOverridesLoadPromise = null;
  }
}

/** 同期読込（メモリ優先、なければローカル）。公開ページは ensure 後に呼ぶ */
export function readActressImageOverrides(): ActressImageOverridesFile {
  const store = memory();
  if (store.__actressImageOverrides) return store.__actressImageOverrides;
  const local = readLocalFile();
  store.__actressImageOverrides = local;
  return local;
}

export function getActressImageOverride(
  slugOrKey: string,
  name?: string,
): ActressImageOverride | null {
  const data = readActressImageOverrides();
  const keys = new Set(
    [slugOrKey, name].filter((value): value is string => Boolean(value)),
  );

  for (const entry of data.overrides) {
    if (keys.has(entry.actress_id) || (entry.key && keys.has(entry.key))) {
      return entry;
    }
  }
  return null;
}

export function isManualActressImageOverride(
  override: ActressImageOverride | null | undefined,
): boolean {
  if (!override) return false;
  if (override.selection_type === "automatic") return false;
  return (
    Boolean(override.image_url || override.imageUrl) ||
    Boolean(override.useDefault) ||
    override.note === "manual-pick" ||
    override.note === "manual-default"
  );
}

async function persistOverrides(
  next: ActressImageOverridesFile,
  message: string,
): Promise<void> {
  const store = memory();
  store.__actressImageOverrides = next;
  writeLocalSafe(next);

  if (!isGitHubCatalogConfigured()) {
    if (process.env.VERCEL === "1") {
      throw new Error(
        "本番では GITHUB_TOKEN / GITHUB_OWNER が必要です。代表画像の手動設定を永続化できません。",
      );
    }
    return;
  }

  const config = getGitHubConfig()!;
  const body: Record<string, string> = {
    message,
    content: Buffer.from(`${JSON.stringify(next, null, 2)}\n`, "utf-8").toString(
      "base64",
    ),
    branch: config.branch,
  };
  if (store.__actressImageOverridesSha) {
    body.sha = store.__actressImageOverridesSha;
  }

  await githubRequest(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${OVERRIDES_RELATIVE}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
  store.__actressImageOverridesSha = null;
}

/** 手動設定 UPSERT（actress_id ユニーク） */
export async function upsertActressImageOverride(input: {
  actress_id: string;
  image_url?: string | null;
  work_id?: string | null;
  selection_type?: ActressImageSelectionType;
  selected_by?: string | null;
  note?: string | null;
  useDefault?: boolean;
  score?: number;
  faceDetected?: boolean;
  isSoloWork?: boolean;
}): Promise<ActressImageOverridesFile> {
  await ensureActressImageOverridesLoaded();
  const current = readActressImageOverrides();
  const now = new Date().toISOString();
  const existing = current.overrides.find(
    (row) => row.actress_id === input.actress_id || row.key === input.actress_id,
  );

  const nextRow: ActressImageOverride = {
    id: existing?.id ?? `override_${input.actress_id}`,
    actress_id: input.actress_id,
    key: input.actress_id,
    work_id: input.work_id ?? null,
    image_url: input.useDefault ? null : (input.image_url ?? null),
    selection_type: input.selection_type ?? "manual",
    selected_by: input.selected_by ?? "admin",
    selected_at: now,
    updated_at: now,
    note: input.note ?? null,
    useDefault: input.useDefault,
    score: input.score,
    faceDetected: input.faceDetected,
    isSoloWork: input.isSoloWork,
    imageUrl: input.useDefault ? undefined : (input.image_url ?? undefined),
    workId: input.work_id ?? null,
  };

  const next: ActressImageOverridesFile = {
    version: 2,
    updatedAt: now,
    overrides: [
      ...current.overrides.filter(
        (row) =>
          row.actress_id !== input.actress_id && row.key !== input.actress_id,
      ),
      nextRow,
    ],
  };

  await persistOverrides(
    next,
    `Upsert actress image override (${input.actress_id})`,
  );
  return next;
}

export async function removeActressImageOverride(
  actressId: string,
): Promise<ActressImageOverridesFile> {
  await ensureActressImageOverridesLoaded();
  const current = readActressImageOverrides();
  const next: ActressImageOverridesFile = {
    version: 2,
    updatedAt: new Date().toISOString(),
    overrides: current.overrides.filter(
      (row) => row.actress_id !== actressId && row.key !== actressId,
    ),
  };
  await persistOverrides(next, `Remove actress image override (${actressId})`);
  return next;
}

/** 自動選定結果を保存（手動設定がある女優はスキップ） */
export async function upsertAutomaticActressImageOverride(input: {
  actress_id: string;
  image_url: string;
  work_id: string | null;
  score?: number;
  faceDetected?: boolean;
  isSoloWork?: boolean;
}): Promise<boolean> {
  await ensureActressImageOverridesLoaded();
  const existing = getActressImageOverride(input.actress_id);
  if (isManualActressImageOverride(existing)) {
    return false;
  }

  await upsertActressImageOverride({
    ...input,
    selection_type: "automatic",
    selected_by: "system",
    note: "automatic",
  });
  return true;
}

export { OVERRIDES_RELATIVE as ACTRESS_IMAGE_OVERRIDES_RELATIVE };
