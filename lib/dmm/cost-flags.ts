/**
 * アダルトカタログ CPU/ISR 削減フラグ。
 * 一時フラグは移行完了後に削除してよい。
 */

/** 表示用シャードをコンパクトJSONで保存（未設定時 true） */
export function isAdultCompactCatalogEnabled(): boolean {
  const raw = process.env.ADULT_COMPACT_CATALOG_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

/** 公開カタログのプロセス内TTLキャッシュ（未設定時 true） */
export function isAdultCatalogCacheEnabled(): boolean {
  const raw = process.env.ADULT_CATALOG_CACHE_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

/** サンプル画像/動画を catalog-media へ分離して読む（未設定時は自動検出） */
export function isAdultMediaShardEnabled(): boolean {
  const raw = process.env.ADULT_MEDIA_SHARD_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

export function getAdultPublicCatalogTtlSec(): number {
  const n = Number(process.env.ADULT_PUBLIC_CATALOG_TTL_SEC ?? 900);
  if (!Number.isFinite(n) || n < 60) return 900;
  return Math.min(3600, Math.floor(n));
}
