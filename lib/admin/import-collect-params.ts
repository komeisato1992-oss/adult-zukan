import {
  IMPORT_COLLECT_REQUEST_COUNT,
  IMPORT_COLLECT_REQUEST_MAX,
  IMPORT_COLLECT_REQUEST_MIN,
} from "@/lib/admin/import-constants";

export type ParsedCollectParams = {
  requestCount: number;
  startOffset: number;
};

export function parseCollectRequestCount(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return IMPORT_COLLECT_REQUEST_COUNT;
  }

  const numeric = typeof value === "string" ? Number(value.trim()) : Number(value);

  if (
    !Number.isFinite(numeric) ||
    !Number.isInteger(numeric) ||
    numeric < IMPORT_COLLECT_REQUEST_MIN ||
    numeric > IMPORT_COLLECT_REQUEST_MAX
  ) {
    throw new Error(
      `取得要求件数は${IMPORT_COLLECT_REQUEST_MIN}〜${IMPORT_COLLECT_REQUEST_MAX}の整数で指定してください。`,
    );
  }

  return numeric;
}

/** 0 は先頭（API offset=1）として扱う。空欄は savedOffset を使用。 */
export function parseCollectStartOffset(
  value: unknown,
  savedOffset: number,
): number {
  if (value === undefined || value === null || value === "") {
    return normalizeDmmOffset(savedOffset);
  }

  const numeric = typeof value === "string" ? Number(value.trim()) : Number(value);

  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0) {
    throw new Error("開始offsetは0以上の整数で指定してください。");
  }

  return normalizeDmmOffset(numeric);
}

export function normalizeDmmOffset(offset: number): number {
  return offset <= 0 ? 1 : Math.floor(offset);
}

export function planCollectPages(
  requestCount: number,
  pageSize: number,
): number {
  return Math.max(1, Math.ceil(requestCount / pageSize));
}

export function nextCollectPageHits(
  requestCount: number,
  apiFetchedCount: number,
  pageSize: number,
): number {
  return Math.min(pageSize, requestCount - apiFetchedCount);
}
