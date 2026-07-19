import "server-only";

import { DMM_ITEMLIST_MAX_HITS } from "@/lib/admin/import-constants";

function readPositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/** 公開可能作品の目標件数 */
export const FANZA_EXPAND_DEFAULT_TARGET = 30_000;

/** API 1回あたりの hits（DMM 上限内の小さいバッチ） */
export function getFanzaExpandBatchSize(): number {
  return Math.min(
    DMM_ITEMLIST_MAX_HITS,
    readPositiveInt(process.env.FANZA_EXPAND_BATCH_SIZE, 100),
  );
}

/** upsert を分割する件数 */
export function getFanzaExpandUpsertChunkSize(): number {
  return Math.min(
    100,
    readPositiveInt(process.env.FANZA_EXPAND_UPSERT_CHUNK, 50),
  );
}

/** API リクエスト間隔（ms） */
export function getFanzaExpandRequestDelayMs(): number {
  return readPositiveInt(process.env.FANZA_EXPAND_REQUEST_DELAY_MS, 1200);
}

export function getFanzaExpandMaxRetries(): number {
  return readPositiveInt(process.env.FANZA_EXPAND_MAX_RETRIES, 5);
}

/** 人気順・新着順の最大 offset（1-based、hits=100 なら約50ページ） */
export function getFanzaExpandSortMaxOffset(): number {
  return readPositiveInt(process.env.FANZA_EXPAND_SORT_MAX_OFFSET, 5001);
}

/** キーワード（ジャンル等）1語あたりの最大 offset */
export function getFanzaExpandKeywordMaxOffset(): number {
  return readPositiveInt(process.env.FANZA_EXPAND_KEYWORD_MAX_OFFSET, 1001);
}

/** 管理画面 1リクエストあたりの最大バッチ数（Vercel 時間制限対策） */
export function getFanzaExpandAdminMaxBatchesPerRequest(): number {
  return readPositiveInt(process.env.FANZA_EXPAND_ADMIN_MAX_BATCHES, 3);
}

/** CLI 1周あたりの最大バッチ数（途中保存用） */
export function getFanzaExpandCliMaxBatchesPerLoop(): number {
  return readPositiveInt(process.env.FANZA_EXPAND_CLI_MAX_BATCHES, 20);
}

export const FANZA_EXPAND_OFFSET_START = 1;

export const FANZA_EXPAND_JOB_PATH = "data/dmm/fanza-expand-job.json";

export {
  FANZA_EXPAND_SOURCE_ORDER,
  type FanzaExpandSourceId,
} from "@/lib/admin/fanza-expand-shared";
