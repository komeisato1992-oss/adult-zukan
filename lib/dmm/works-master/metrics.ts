import "server-only";

export type WorksMasterMetricsSnapshot = {
  supabaseSavedCount: number;
  jsonFallbackCount: number;
  lastBackend: "supabase" | "local" | "off" | null;
  lastError: string | null;
  lastAt: string | null;
};

type Holder = typeof globalThis & {
  __worksMasterMetrics?: WorksMasterMetricsSnapshot;
};

function getMetrics(): WorksMasterMetricsSnapshot {
  const g = globalThis as Holder;
  if (!g.__worksMasterMetrics) {
    g.__worksMasterMetrics = {
      supabaseSavedCount: 0,
      jsonFallbackCount: 0,
      lastBackend: null,
      lastError: null,
      lastAt: null,
    };
  }
  return g.__worksMasterMetrics;
}

export function recordWorksMasterWrite(input: {
  backend: "supabase" | "local" | "off";
  upserted: number;
  usedJsonFallback: boolean;
  error?: string | null;
}): void {
  const metrics = getMetrics();
  if (input.backend === "supabase" && !input.usedJsonFallback) {
    metrics.supabaseSavedCount += input.upserted;
  }
  if (input.usedJsonFallback) {
    metrics.jsonFallbackCount += input.upserted;
  }
  metrics.lastBackend = input.backend;
  metrics.lastError = input.error ?? null;
  metrics.lastAt = new Date().toISOString();
}

export function getWorksMasterMetricsSummary(): WorksMasterMetricsSnapshot {
  return { ...getMetrics() };
}

export function resetWorksMasterMetrics(): void {
  const g = globalThis as Holder;
  g.__worksMasterMetrics = {
    supabaseSavedCount: 0,
    jsonFallbackCount: 0,
    lastBackend: null,
    lastError: null,
    lastAt: null,
  };
}
