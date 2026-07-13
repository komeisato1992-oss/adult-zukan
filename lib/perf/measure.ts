/**
 * 軽量パフォーマンス計測。
 * PERFORMANCE_DEBUG=true のときだけ詳細ログを出す（本番では大量ログ禁止）。
 * APIキー・raw全文・秘密情報は絶対に出さない。
 */

export type PerfSample = {
  name: string;
  durationMs: number;
  at: string;
};

const samples: PerfSample[] = [];
const counters = new Map<string, number>();

function isPerfDebugEnabled(): boolean {
  return process.env.PERFORMANCE_DEBUG === "true";
}

export function incrPerfCounter(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export function getPerfCounter(name: string): number {
  return counters.get(name) ?? 0;
}

export function resetPerfCounters(): void {
  counters.clear();
  samples.length = 0;
}

export function getPerfSnapshot(): {
  counters: Record<string, number>;
  samples: PerfSample[];
} {
  return {
    counters: Object.fromEntries(counters.entries()),
    samples: [...samples],
  };
}

export function measureSync<T>(name: string, fn: () => T): T {
  const started = performance.now();
  try {
    return fn();
  } finally {
    const durationMs = performance.now() - started;
    samples.push({ name, durationMs, at: new Date().toISOString() });
    incrPerfCounter(`${name}.calls`);
    incrPerfCounter(`${name}.ms`, Math.round(durationMs));
    if (isPerfDebugEnabled()) {
      console.info(`[perf] ${name} ${durationMs.toFixed(1)}ms`);
    }
  }
}

export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    return await fn();
  } finally {
    const durationMs = performance.now() - started;
    samples.push({ name, durationMs, at: new Date().toISOString() });
    incrPerfCounter(`${name}.calls`);
    incrPerfCounter(`${name}.ms`, Math.round(durationMs));
    if (isPerfDebugEnabled()) {
      console.info(`[perf] ${name} ${durationMs.toFixed(1)}ms`);
    }
  }
}
