import type { ImportCandidateListItem, ImportCandidateStatus } from "@/lib/admin/import-candidate-types";
import type { DmmItem } from "@/lib/dmm/types";

const VALID_STATUSES = new Set<ImportCandidateStatus>([
  "candidate",
  "added",
  "excluded",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStatus(record: Record<string, unknown>): ImportCandidateStatus {
  const status = record.status;
  if (
    typeof status === "string" &&
    VALID_STATUSES.has(status as ImportCandidateStatus)
  ) {
    return status as ImportCandidateStatus;
  }
  return "candidate";
}

function readDmmItem(value: unknown, contentId: string): DmmItem | null {
  if (!isObject(value)) return null;

  const resolvedContentId =
    (typeof value.content_id === "string" && value.content_id.trim()) ||
    contentId;
  if (!resolvedContentId) return null;

  return {
    ...value,
    content_id: resolvedContentId,
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title.trim()
        : resolvedContentId,
  } as DmmItem;
}

function normalizeListItem(value: unknown): ImportCandidateListItem | null {
  if (!isObject(value)) return null;

  const contentId =
    (typeof value.contentId === "string" && value.contentId.trim()) ||
    (typeof value.content_id === "string" && value.content_id.trim()) ||
    "";

  const item = readDmmItem(value.item, contentId) ?? readDmmItem(value, contentId);
  if (!item?.content_id?.trim()) return null;

  const resolvedContentId = item.content_id.trim();
  const status = readStatus(value);

  return {
    contentId: resolvedContentId,
    item: {
      ...item,
      content_id: resolvedContentId,
      title: item.title?.trim() || resolvedContentId,
    },
    source:
      typeof value.source === "string" && value.source.trim()
        ? value.source.trim()
        : "import",
    collectedAt:
      typeof value.collectedAt === "string" && value.collectedAt.trim()
        ? value.collectedAt.trim()
        : new Date().toISOString(),
    status,
    isAdded: value.isAdded === true || status === "added",
    isExcluded: value.isExcluded === true || status === "excluded",
  };
}

/** API レスポンスなど unknown 入力を ImportCandidateListItem[] に正規化 */
export function normalizeCandidates(input: unknown): ImportCandidateListItem[] {
  let data = input;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }

  if (Array.isArray(data)) {
    return data
      .map((entry) => normalizeListItem(entry))
      .filter((entry): entry is ImportCandidateListItem => entry !== null);
  }

  if (isObject(data)) {
    for (const key of ["candidates", "items", "records", "data", "results"] as const) {
      const value = data[key];
      if (Array.isArray(value)) {
        return normalizeCandidates(value);
      }
    }
  }

  return [];
}
