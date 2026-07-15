import "server-only";

/** ISO時刻比較。無効・未設定は最古扱い */
export function parseCacheTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

/** a が b 以上に新しい（同値含む）なら true */
export function isCacheAtLeastAsNew(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return parseCacheTimestamp(a) >= parseCacheTimestamp(b);
}

export function pickFreshestByUpdatedAt<T extends { updatedAt?: string | null }>(
  candidates: Array<T | null | undefined>,
): T | null {
  let best: T | null = null;
  let bestTs = -1;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const ts = parseCacheTimestamp(candidate.updatedAt);
    if (ts > bestTs) {
      best = candidate;
      bestTs = ts;
    } else if (ts === bestTs && bestTs === 0 && !best) {
      best = candidate;
    }
  }
  return best;
}
