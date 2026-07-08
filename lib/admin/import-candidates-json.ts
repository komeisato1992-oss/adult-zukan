import { dmmItemToStoredCandidate } from "@/lib/admin/import-candidate-mapper";
import type {
  ImportCandidateStatus,
  StoredImportCandidate,
} from "@/lib/admin/import-candidate-types";
import type { DmmItem } from "@/lib/dmm/types";

export type ImportCandidatesDocument = {
  updatedAt: string;
  total: number;
  items: StoredImportCandidate[];
};

export class ImportCandidatesJsonError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ImportCandidatesJsonError";
    this.status = status;
  }
}

/** JSON 構文が壊れている場合のみ投げる（初期化ボタン表示用） */
export class ImportCandidatesJsonCorruptError extends ImportCandidatesJsonError {
  constructor(
    message = "import-candidates.json の JSON が壊れています。",
  ) {
    super(message, 500);
    this.name = "ImportCandidatesJsonCorruptError";
  }
}

const WRAPPER_ARRAY_KEYS = [
  "items",
  "candidates",
  "records",
  "data",
  "results",
] as const;

const VALID_STATUSES: ImportCandidateStatus[] = [
  "candidate",
  "added",
  "excluded",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readContentId(record: Record<string, unknown>): string | null {
  if (typeof record.content_id === "string" && record.content_id.trim()) {
    return record.content_id.trim();
  }
  if (typeof record.contentId === "string" && record.contentId.trim()) {
    return record.contentId.trim();
  }
  return null;
}

function readStatus(record: Record<string, unknown>): ImportCandidateStatus {
  const status = record.status;
  if (
    typeof status === "string" &&
    VALID_STATUSES.includes(status as ImportCandidateStatus)
  ) {
    return status as ImportCandidateStatus;
  }
  return "candidate";
}

function normalizeDmmItem(
  item: Record<string, unknown>,
  contentId: string,
): DmmItem | null {
  const resolvedContentId =
    (typeof item.content_id === "string" && item.content_id.trim()) ||
    contentId;

  if (!resolvedContentId) return null;

  return {
    ...item,
    content_id: resolvedContentId,
    title: typeof item.title === "string" ? item.title : "",
  } as DmmItem;
}

function normalizeImportCandidate(value: unknown): StoredImportCandidate | null {
  if (!isObject(value)) return null;

  const itemRaw = value.item;
  if (!isObject(itemRaw)) return null;

  const contentId =
    readContentId(value) ??
    (typeof itemRaw.content_id === "string" && itemRaw.content_id.trim()
      ? itemRaw.content_id.trim()
      : null);

  if (!contentId) return null;

  const dmmItem = normalizeDmmItem(itemRaw, contentId);
  if (!dmmItem) return null;

  const source =
    typeof value.source === "string" && value.source.trim()
      ? value.source.trim()
      : "import";
  const collectedAt =
    typeof value.collectedAt === "string" && value.collectedAt.trim()
      ? value.collectedAt.trim()
      : new Date().toISOString();

  const derived = dmmItemToStoredCandidate(dmmItem, source);

  return {
    ...derived,
    content_id: contentId,
    status: readStatus(value),
    collectedAt,
    source,
  };
}

function extractRawCandidateEntries(data: unknown): unknown[] {
  if (data === null || data === undefined) return [];

  if (Array.isArray(data)) {
    return data;
  }

  if (!isObject(data)) {
    return [];
  }

  for (const key of WRAPPER_ARRAY_KEYS) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const value of Object.values(data)) {
    if (
      Array.isArray(value) &&
      value.some((entry) => isObject(entry) && ("item" in entry || "content_id" in entry))
    ) {
      return value;
    }
  }

  return [];
}

/** 配列・ラップ形式を問わず StoredImportCandidate[] に正規化する */
export function normalizeImportCandidates(data: unknown): StoredImportCandidate[] {
  const rawEntries = extractRawCandidateEntries(data);
  const normalized: StoredImportCandidate[] = [];

  for (const entry of rawEntries) {
    const candidate = normalizeImportCandidate(entry);
    if (candidate) {
      normalized.push(candidate);
    }
  }

  return normalized;
}

/** 配列・ラップ形式の JSON を読み込む（形式差異では空にしない） */
export function parseImportCandidatesJson(raw: string): StoredImportCandidate[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new ImportCandidatesJsonCorruptError();
  }

  return normalizeImportCandidates(parsed);
}

/** 候補一覧は配列形式で保存 */
export function serializeImportCandidates(
  records: StoredImportCandidate[],
): string {
  return `${JSON.stringify(records, null, 2)}\n`;
}

export function isImportCandidatesJsonCorruptError(
  error: unknown,
): error is ImportCandidatesJsonCorruptError {
  return error instanceof ImportCandidatesJsonCorruptError;
}
