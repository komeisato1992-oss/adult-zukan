import "server-only";

export type WorkLiveStatusRequestMetrics = {
  requestedCount: number;
  dbHitCount: number;
  jsonFallbackCount: number;
  dbFetchMs: number;
  totalMs: number;
  cacheHit: boolean;
  backend: string;
  at: string;
};

type MetricsHolder = typeof globalThis & {
  __workLiveStatusMetrics?: {
    samples: WorkLiveStatusRequestMetrics[];
    cacheHits: number;
    cacheMisses: number;
  };
};

const MAX_SAMPLES = 40;

function getHolder() {
  const g = globalThis as MetricsHolder;
  if (!g.__workLiveStatusMetrics) {
    g.__workLiveStatusMetrics = {
      samples: [],
      cacheHits: 0,
      cacheMisses: 0,
    };
  }
  return g.__workLiveStatusMetrics;
}

export function recordWorkLiveStatusMetrics(
  sample: Omit<WorkLiveStatusRequestMetrics, "at"> & { at?: string },
): void {
  const holder = getHolder();
  if (sample.cacheHit) holder.cacheHits += 1;
  else holder.cacheMisses += 1;

  holder.samples.unshift({
    ...sample,
    at: sample.at ?? new Date().toISOString(),
  });
  if (holder.samples.length > MAX_SAMPLES) {
    holder.samples.length = MAX_SAMPLES;
  }
}

export function getWorkLiveStatusMetricsSummary(): {
  recent: WorkLiveStatusRequestMetrics[];
  cacheHitRate: number | null;
  cacheHits: number;
  cacheMisses: number;
  last: WorkLiveStatusRequestMetrics | null;
} {
  const holder = getHolder();
  const total = holder.cacheHits + holder.cacheMisses;
  return {
    recent: holder.samples.slice(0, 10),
    cacheHitRate: total > 0 ? holder.cacheHits / total : null,
    cacheHits: holder.cacheHits,
    cacheMisses: holder.cacheMisses,
    last: holder.samples[0] ?? null,
  };
}

export function resetWorkLiveStatusMetrics(): void {
  const g = globalThis as MetricsHolder;
  g.__workLiveStatusMetrics = {
    samples: [],
    cacheHits: 0,
    cacheMisses: 0,
  };
}
