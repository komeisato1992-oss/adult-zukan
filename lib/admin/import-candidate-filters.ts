import type { ImportFilterKey } from "@/lib/admin/import-quality";

/** 候補一覧・一括追加で共有する有効フィルターキー */
export const VALID_IMPORT_FILTER_KEYS = new Set<ImportFilterKey>([
  "hasImage",
  "hasActress",
  "hasPrice",
  "hasDescription",
  "hasSampleImages",
  "isSoloWork",
  "isOnSale",
  "seoRankingOnly",
  "seoNewReleaseOnly",
  "seoPopularActressOnly",
  "seoPopularMakerOnly",
  "seoPopularSeriesOnly",
]);

/** クライアント・API で共有するフィルター型（有効キーのみ） */
export type ImportCandidateFilters = ImportFilterKey[];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidFilterKey(key: string): key is ImportFilterKey {
  return VALID_IMPORT_FILTER_KEYS.has(key as ImportFilterKey);
}

/** 旧キー名との互換マップ */
const LEGACY_IMPORT_FILTER_KEY_ALIASES: Record<string, ImportFilterKey> = {
  hasSampleImage: "hasSampleImages",
  hasSampleImages: "hasSampleImages",
  singleWork: "isSoloWork",
  isSingleWork: "isSoloWork",
  sale: "isOnSale",
  isSale: "isOnSale",
};

function resolveImportFilterKey(raw: string): ImportFilterKey | null {
  const key = raw.trim();
  if (!key) return null;

  if (isValidFilterKey(key)) {
    return key;
  }

  const alias = LEGACY_IMPORT_FILTER_KEY_ALIASES[key];
  if (alias && isValidFilterKey(alias)) {
    return alias;
  }

  return null;
}

/** 文字列配列を有効キーのみに正規化する */
export function normalizeImportCandidateFilterKeys(
  keys: Iterable<string>,
): ImportFilterKey[] {
  const normalized: ImportFilterKey[] = [];
  const seen = new Set<ImportFilterKey>();

  for (const raw of keys) {
    if (typeof raw !== "string") continue;
    const key = resolveImportFilterKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  return normalized;
}

/**
 * 一覧API・一括追加APIで同一のフィルター解釈を行う。
 * - 配列: ["hasImage", "hasActress"]
 * - カンマ区切り文字列: "hasImage,hasActress"
 * - 真偽オブジェクト: { hasImage: true } → hasImage のみ適用。false は「条件なし」
 */
export function parseImportCandidateFilters(input: unknown): ImportFilterKey[] {
  if (input == null) return [];

  if (typeof input === "string") {
    if (!input.trim()) return [];
    return normalizeImportCandidateFilterKeys(input.split(","));
  }

  if (Array.isArray(input)) {
    return normalizeImportCandidateFilterKeys(
      input.filter((entry): entry is string => typeof entry === "string"),
    );
  }

  if (isObject(input)) {
    const active: string[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (value === true) {
        active.push(key);
      }
    }
    return normalizeImportCandidateFilterKeys(active);
  }

  return [];
}
