import type { DmmItem } from "@/lib/dmm/types";

/** リポジトリ内パス（ローカル・GitHub 共通） */
export const CATALOG_SNAPSHOT_RELATIVE_PATH = "data/dmm/catalog-snapshot.json";

const WRAPPER_ARRAY_KEYS = [
  "works",
  "items",
  "catalog",
  "data",
  "products",
] as const;

export type CatalogSnapshotWrapperKey = (typeof WRAPPER_ARRAY_KEYS)[number];

export type CatalogSnapshotEnvelope =
  | { format: "array" }
  | {
      format: "object";
      key: CatalogSnapshotWrapperKey;
      base: Record<string, unknown>;
    }
  | { format: "rebuilt" };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** JSON文字列 / 二重stringify を最大2段で剥がす */
export function parseJsonMaybe(value: unknown): unknown {
  let data = value;

  for (let index = 0; index < 2; index += 1) {
    if (typeof data !== "string") break;

    try {
      data = JSON.parse(data);
    } catch {
      break;
    }
  }

  return data;
}

function extractRawEntries(data: unknown): unknown[] {
  const parsed = parseJsonMaybe(data);

  if (parsed === null || parsed === undefined) return [];

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (isObject(parsed)) {
    for (const key of WRAPPER_ARRAY_KEYS) {
      const value = parsed[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
}

function isDmmItemLike(value: unknown): value is DmmItem {
  if (!isObject(value)) return false;

  const contentId = value.content_id;
  if (typeof contentId === "string" && contentId.trim()) {
    return true;
  }

  const legacyId = value.id;
  return typeof legacyId === "string" && legacyId.trim().length > 0;
}

function normalizeDmmItemEntry(value: unknown): DmmItem | null {
  if (!isDmmItemLike(value)) return null;

  const record = value as Record<string, unknown>;
  const contentId =
    (typeof record.content_id === "string" && record.content_id.trim()) ||
    (typeof record.id === "string" && record.id.trim()) ||
    "";

  if (!contentId) return null;

  return {
    ...(record as DmmItem),
    content_id: contentId,
    product_id:
      typeof record.product_id === "string" && record.product_id.trim()
        ? record.product_id.trim()
        : contentId,
    title:
      typeof record.title === "string" && record.title.trim()
        ? record.title.trim()
        : contentId,
  };
}

/** 配列・ラップ形式を問わず DmmItem[] に正規化する */
export function normalizeCatalogSnapshot(input: unknown): DmmItem[] {
  const normalized: DmmItem[] = [];

  for (const entry of extractRawEntries(input)) {
    const item = normalizeDmmItemEntry(entry);
    if (item) {
      normalized.push(item);
    }
  }

  return normalized;
}

/** 既存カタログ作品配列だけを取り出す（正規化前でも可） */
export function getCatalogWorks(input: unknown): unknown[] {
  return extractRawEntries(input);
}

export function hasRecognizedCatalogSnapshotShape(data: unknown): boolean {
  const parsed = parseJsonMaybe(data);
  if (parsed === null || parsed === undefined) return true;
  if (Array.isArray(parsed)) return true;

  if (isObject(parsed)) {
    return WRAPPER_ARRAY_KEYS.some((key) => Array.isArray(parsed[key]));
  }

  return false;
}

export function detectCatalogSnapshotEnvelope(
  data: unknown,
): CatalogSnapshotEnvelope {
  const parsed = parseJsonMaybe(data);

  if (Array.isArray(parsed)) {
    return { format: "array" };
  }

  if (isObject(parsed)) {
    for (const key of WRAPPER_ARRAY_KEYS) {
      if (Array.isArray(parsed[key])) {
        return {
          format: "object",
          key,
          base: parsed,
        };
      }
    }
  }

  return { format: "rebuilt" };
}

export function parseCatalogSnapshot(data: unknown): {
  items: DmmItem[];
  envelope: CatalogSnapshotEnvelope;
  rebuilt: boolean;
} {
  const parsed = parseJsonMaybe(data);
  const envelope = detectCatalogSnapshotEnvelope(parsed);
  const items = normalizeCatalogSnapshot(parsed);
  const rebuilt = envelope.format === "rebuilt";

  if (rebuilt) {
    console.warn(
      "catalog-snapshot.json could not be normalized. Rebuilding as { works: [...] }",
    );
  }

  return { items, envelope, rebuilt };
}

/** 既存形式を維持して保存用データを構築する */
export function buildCatalogOutput(
  originalRaw: unknown,
  mergedWorks: DmmItem[],
): unknown {
  const original = parseJsonMaybe(originalRaw);

  if (Array.isArray(original)) {
    return mergedWorks;
  }

  if (isObject(original)) {
    for (const key of WRAPPER_ARRAY_KEYS) {
      if (Array.isArray(original[key])) {
        return {
          ...original,
          [key]: mergedWorks,
          updatedAt: new Date().toISOString(),
        };
      }
    }
  }

  console.warn(
    "catalog-snapshot.json could not be normalized. Rebuilding as { works: [...] }",
  );

  return {
    works: mergedWorks,
    updatedAt: new Date().toISOString(),
  };
}

export function buildCatalogSnapshotSaveData(
  envelope: CatalogSnapshotEnvelope,
  mergedItems: DmmItem[],
): unknown {
  if (envelope.format === "array") {
    return mergedItems;
  }

  if (envelope.format === "object") {
    return {
      ...envelope.base,
      [envelope.key]: mergedItems,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    works: mergedItems,
    updatedAt: new Date().toISOString(),
  };
}

export function serializeCatalogSnapshot(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function logCatalogSnapshotDebug(raw: unknown): void {
  console.error("catalog-snapshot debug:", {
    type: typeof raw,
    isArray: Array.isArray(raw),
    keys: raw && typeof raw === "object" ? Object.keys(raw as object) : null,
    sample: Array.isArray(raw) ? (raw as unknown[])[0] : raw,
  });
}

/** throw / catch 直前で本当の例外をそのまま出力する */
export function logCatalogSnapshotThrownError(error: unknown): void {
  if (error instanceof Error) {
    console.error(error.stack);
    console.error(error.message);
  }
  console.error(error);
}

export function logInvalidCatalogSnapshotFormat(data: unknown): void {
  logCatalogSnapshotDebug(data);
}
