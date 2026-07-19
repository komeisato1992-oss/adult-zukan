import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type FanzaSyncTargetScope = "all" | "unchecked";

export type FanzaSyncProgressEntry = {
  /** 次回実行の開始オフセット（安定順・cid昇順） */
  nextOffset: number;
  /** 直近ランの開始オフセット */
  lastRunStart: number | null;
  /** 直近ランで処理した最終インデックス（inclusive）。未処理なら null */
  lastRunEnd: number | null;
  lastLimit: number | null;
  lastMode: string | null;
  updatedAt: string | null;
};

export type FanzaSyncProgressState = {
  scopes: Record<FanzaSyncTargetScope, FanzaSyncProgressEntry>;
  /**
   * works.updated_at 差分取得のウォーターマーク（ISO）。
   * 未設定時は全件マスター取得をせず、CID 一覧 + ローカル JSON + バッチ列取得のみ行う。
   */
  worksMasterUpdatedAtWatermark: string | null;
};

export const FANZA_SYNC_PROGRESS_RELATIVE_PATH =
  "data/dmm/fanza-sync-progress.json";

const LOCAL_PATH = path.join(
  process.cwd(),
  FANZA_SYNC_PROGRESS_RELATIVE_PATH,
);

function emptyEntry(): FanzaSyncProgressEntry {
  return {
    nextOffset: 0,
    lastRunStart: null,
    lastRunEnd: null,
    lastLimit: null,
    lastMode: null,
    updatedAt: null,
  };
}

export function createEmptyFanzaSyncProgress(): FanzaSyncProgressState {
  return {
    scopes: {
      all: emptyEntry(),
      unchecked: emptyEntry(),
    },
    worksMasterUpdatedAtWatermark: null,
  };
}

function normalizeEntry(raw: unknown): FanzaSyncProgressEntry {
  if (!raw || typeof raw !== "object") return emptyEntry();
  const v = raw as Partial<FanzaSyncProgressEntry>;
  const nextOffset = Math.max(0, Math.floor(Number(v.nextOffset ?? 0) || 0));
  return {
    nextOffset,
    lastRunStart:
      v.lastRunStart == null ? null : Math.max(0, Math.floor(Number(v.lastRunStart))),
    lastRunEnd:
      v.lastRunEnd == null ? null : Math.max(0, Math.floor(Number(v.lastRunEnd))),
    lastLimit:
      v.lastLimit == null ? null : Math.max(1, Math.floor(Number(v.lastLimit))),
    lastMode: v.lastMode == null ? null : String(v.lastMode),
    updatedAt: v.updatedAt == null ? null : String(v.updatedAt),
  };
}

export function parseFanzaSyncProgress(raw: unknown): FanzaSyncProgressState {
  const empty = createEmptyFanzaSyncProgress();
  if (!raw || typeof raw !== "object") return empty;
  const scopes = (raw as { scopes?: unknown }).scopes;
  if (!scopes || typeof scopes !== "object") return empty;
  const s = scopes as Record<string, unknown>;
  const watermarkRaw = (raw as { worksMasterUpdatedAtWatermark?: unknown })
    .worksMasterUpdatedAtWatermark;
  const watermark =
    typeof watermarkRaw === "string" && watermarkRaw.trim()
      ? watermarkRaw.trim()
      : null;
  return {
    scopes: {
      all: normalizeEntry(s.all),
      unchecked: normalizeEntry(s.unchecked),
    },
    worksMasterUpdatedAtWatermark: watermark,
  };
}

export function loadFanzaSyncProgress(): FanzaSyncProgressState {
  if (!existsSync(LOCAL_PATH)) return createEmptyFanzaSyncProgress();
  try {
    return parseFanzaSyncProgress(JSON.parse(readFileSync(LOCAL_PATH, "utf8")));
  } catch {
    return createEmptyFanzaSyncProgress();
  }
}

export function saveFanzaSyncProgress(state: FanzaSyncProgressState): void {
  const dir = path.dirname(LOCAL_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(LOCAL_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function getFanzaSyncProgressEntry(
  scope: FanzaSyncTargetScope,
): FanzaSyncProgressEntry {
  return loadFanzaSyncProgress().scopes[scope] ?? emptyEntry();
}

/**
 * バッチ成功分まで進捗を進める。
 * nextOffset = runStart + processedCount（次回は続きから）。
 * universe を超えたら 0 に戻す。
 */
export function advanceFanzaSyncProgress(input: {
  scope: FanzaSyncTargetScope;
  runStartOffset: number;
  processedCount: number;
  limit: number;
  mode: string;
  universeCount: number;
}): FanzaSyncProgressEntry {
  const state = loadFanzaSyncProgress();
  const processed = Math.max(0, Math.floor(input.processedCount));
  const runStart = Math.max(0, Math.floor(input.runStartOffset));
  let nextOffset = runStart + processed;
  const universe = Math.max(0, Math.floor(input.universeCount));
  // 未確認のみ: 処理済みは image_status が埋まり集合から外れるため、常に先頭から続ける
  if (input.scope === "unchecked") {
    nextOffset = 0;
  } else if (universe > 0 && nextOffset >= universe) {
    nextOffset = 0;
  }
  const entry: FanzaSyncProgressEntry = {
    nextOffset,
    lastRunStart: runStart,
    lastRunEnd: processed > 0 ? runStart + processed - 1 : null,
    lastLimit: Math.max(1, Math.floor(input.limit)),
    lastMode: input.mode,
    updatedAt: new Date().toISOString(),
  };
  state.scopes[input.scope] = entry;
  saveFanzaSyncProgress(state);
  return entry;
}

export function resetFanzaSyncProgress(
  scope: FanzaSyncTargetScope,
): FanzaSyncProgressEntry {
  const state = loadFanzaSyncProgress();
  const entry = emptyEntry();
  entry.updatedAt = new Date().toISOString();
  state.scopes[scope] = entry;
  saveFanzaSyncProgress(state);
  return entry;
}

export function setFanzaSyncProgressOffset(
  scope: FanzaSyncTargetScope,
  offset: number,
): FanzaSyncProgressEntry {
  const state = loadFanzaSyncProgress();
  const prev = state.scopes[scope] ?? emptyEntry();
  const entry: FanzaSyncProgressEntry = {
    ...prev,
    nextOffset: Math.max(0, Math.floor(offset)),
    updatedAt: new Date().toISOString(),
  };
  state.scopes[scope] = entry;
  saveFanzaSyncProgress(state);
  return entry;
}

export function isFanzaSyncTargetScope(
  value: unknown,
): value is FanzaSyncTargetScope {
  return value === "all" || value === "unchecked";
}

export function getWorksMasterUpdatedAtWatermark(): string | null {
  return loadFanzaSyncProgress().worksMasterUpdatedAtWatermark;
}

/**
 * 差分取得で観測した最大 updated_at までウォーターマークを進める。
 * 現在値より古い値では進めない。
 */
export function advanceWorksMasterUpdatedAtWatermark(
  observedMaxUpdatedAt: string | null | undefined,
): string | null {
  const next = observedMaxUpdatedAt?.trim();
  if (!next) return getWorksMasterUpdatedAtWatermark();

  const state = loadFanzaSyncProgress();
  const current = state.worksMasterUpdatedAtWatermark;
  const currentMs = current ? Date.parse(current) : NaN;
  const nextMs = Date.parse(next);
  if (!Number.isFinite(nextMs)) return current;
  if (Number.isFinite(currentMs) && nextMs <= currentMs) {
    return current;
  }

  state.worksMasterUpdatedAtWatermark = next;
  saveFanzaSyncProgress(state);
  return next;
}
