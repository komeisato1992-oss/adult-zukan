/**
 * Vercel CPU/ISR 削減まわりの一時ロールバック用フラグ。
 * 新方式が安定したら削除してよい。
 *
 * 未設定時は「安全な新方式」を有効にする。
 * 問題時のみ明示的に false で旧挙動へ戻す。
 */

function envFlag(name: string, defaultEnabled: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return defaultEnabled;
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false;
  }
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") {
    return true;
  }
  return defaultEnabled;
}

/** 表示用 works をコンパクト JSON で保存する */
export function isDoujinCompactCatalogEnabled(): boolean {
  return envFlag("DOUJIN_COMPACT_CATALOG_ENABLED", true);
}

/** 公開カタログの Data Cache（unstable_cache） */
export function isDoujinCatalogCacheEnabled(): boolean {
  return envFlag("DOUJIN_CATALOG_CACHE_ENABLED", true);
}

/** import/fetch をリクエスト単位バッチ＋メモリ内 Map で処理する */
export function isDoujinBatchedImportEnabled(): boolean {
  return envFlag("DOUJIN_BATCHED_IMPORT_ENABLED", true);
}

/** エンティティ詳細から force-dynamic を外す（ページ側定数と併用） */
export function isEntityIsrEnabled(): boolean {
  return envFlag("ENTITY_ISR_ENABLED", true);
}

/** 作品詳細を長期 ISR（7日）にする */
export function isLongWorkIsrEnabled(): boolean {
  return envFlag("LONG_WORK_ISR_ENABLED", true);
}

export function getDoujinAdminBatchSize(): number {
  const n = Number(process.env.DOUJIN_ADMIN_BATCH_SIZE ?? 500);
  if (!Number.isFinite(n) || n <= 0) return 500;
  return Math.min(500, Math.floor(n));
}

export function getDoujinAdminMaxBatchesPerRequest(): number {
  const n = Number(process.env.DOUJIN_ADMIN_MAX_BATCHES_PER_REQUEST ?? 1);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(5, Math.floor(n));
}

/** 公開カタログ Data Cache 秒数（既定 15 分） */
export function getDoujinPublicCatalogRevalidateSec(): number {
  const n = Number(process.env.DOUJIN_PUBLIC_CATALOG_REVALIDATE_SEC ?? 900);
  if (!Number.isFinite(n) || n < 60) return 900;
  return Math.floor(n);
}
