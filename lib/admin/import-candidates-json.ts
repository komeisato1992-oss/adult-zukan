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
    title:
      typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : resolvedContentId,
  } as DmmItem;
}

function isBareDmmItemRecord(record: Record<string, unknown>): boolean {
  return (
    typeof record.product_id === "string" ||
    typeof record.service_code === "string" ||
    typeof record.floor_code === "string"
  );
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (isObject(entry) && typeof entry.name === "string") {
        return entry.name.trim();
      }
      return "";
    })
    .filter(Boolean);
}

function flatRecordToStoredCandidate(
  record: Record<string, unknown>,
  contentId: string,
): StoredImportCandidate {
  const source =
    typeof record.source === "string" && record.source.trim()
      ? record.source.trim()
      : "import";
  const collectedAt =
    typeof record.collectedAt === "string" && record.collectedAt.trim()
      ? record.collectedAt.trim()
      : new Date().toISOString();
  const imageURL =
    typeof record.imageURL === "string" && record.imageURL.trim()
      ? record.imageURL.trim()
      : "";
  const durationValue = record.duration;
  const duration =
    typeof durationValue === "number"
      ? durationValue
      : typeof durationValue === "string" && durationValue.trim()
        ? Number.parseInt(durationValue, 10)
        : null;

  const stub: StoredImportCandidate = {
    content_id: contentId,
    title:
      typeof record.title === "string" && record.title.trim()
        ? record.title.trim()
        : contentId,
    imageURL,
    actresses: readStringArray(record.actresses),
    maker: typeof record.maker === "string" ? record.maker : "",
    label: typeof record.label === "string" ? record.label : "",
    series: typeof record.series === "string" ? record.series : "",
    genres: readStringArray(record.genres),
    price: typeof record.price === "string" ? record.price : "",
    releaseDate: typeof record.releaseDate === "string" ? record.releaseDate : "",
    duration: Number.isFinite(duration) ? duration : null,
    affiliateURL:
      typeof record.affiliateURL === "string" ? record.affiliateURL : "",
    description:
      typeof record.description === "string" ? record.description : "",
    sampleImages: readStringArray(record.sampleImages),
    source,
    collectedAt,
    status: readStatus(record),
    item: {} as DmmItem,
  };

  stub.item = flatFieldsToDmmItem(stub);
  return stub;
}

function flatFieldsToDmmItem(record: StoredImportCandidate): DmmItem {
  const imageURL = record.imageURL?.trim();

  return {
    content_id: record.content_id,
    title: record.title || record.content_id,
    imageURL: imageURL
      ? { large: imageURL, list: imageURL, small: imageURL }
      : undefined,
    iteminfo: {
      actress: record.actresses.map((name) => ({ name })),
      genre: record.genres.map((name) => ({ name })),
    },
    prices: record.price ? { price: record.price } : undefined,
    date: record.releaseDate || undefined,
    volume: record.duration != null ? String(record.duration) : undefined,
    affiliateURL: record.affiliateURL || undefined,
    URL: record.affiliateURL || undefined,
  } as DmmItem;
}

function normalizeImportCandidate(value: unknown): StoredImportCandidate | null {
  if (!isObject(value)) return null;

  const contentId = readContentId(value);
  if (!contentId) return null;

  const itemRaw = value.item;
  if (isObject(itemRaw)) {
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

  if (isBareDmmItemRecord(value)) {
    const dmmItem = normalizeDmmItem(value, contentId);
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

  if (typeof value.title === "string" || typeof value.imageURL === "string") {
    return flatRecordToStoredCandidate(value, contentId);
  }

  const minimalItem = normalizeDmmItem({ content_id: contentId, title: contentId }, contentId);
  if (!minimalItem) return null;

  const derived = dmmItemToStoredCandidate(minimalItem, "import");
  return {
    ...derived,
    content_id: contentId,
    status: readStatus(value),
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
