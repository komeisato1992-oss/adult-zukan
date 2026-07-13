/**
 * 同人公開カタログのプロセス内キャッシュ無効化。
 * upsert ↔ catalog の循環依存を避けるための小さなモジュール。
 */
import { incrPerfCounter } from "@/lib/perf/measure";

type MemoryHolder = {
  cache: unknown;
};

const holder: MemoryHolder = { cache: null };

export function getDoujinPublicCatalogMemoryHolder(): MemoryHolder {
  return holder;
}

export function invalidateDoujinPublicCatalogMemory(): void {
  holder.cache = null;
  incrPerfCounter("doujin.public.catalog.invalidate");
}
