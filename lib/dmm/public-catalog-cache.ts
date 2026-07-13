/**
 * アダルト公開カタログのプロセス内キャッシュ無効化。
 */
import { incrPerfCounter } from "@/lib/perf/measure";

type MemoryHolder = {
  cache: unknown;
  mtimeMs: number;
  loadedAt: number;
};

const holder: MemoryHolder = {
  cache: null,
  mtimeMs: 0,
  loadedAt: 0,
};

export function getAdultPublicCatalogMemoryHolder(): MemoryHolder {
  return holder;
}

export function invalidateAdultPublicCatalogMemory(): void {
  holder.cache = null;
  holder.mtimeMs = 0;
  holder.loadedAt = 0;
  incrPerfCounter("adult.public.catalog.invalidate");
}
