import type { SnsPostHistoryEntry } from "@/lib/admin/sns-post-history-types";
import type { SnsPostType } from "@/lib/admin/sns-types";

const VALID_POST_TYPES: SnsPostType[] = [
  "recommended-work",
  "compare",
  "actress",
  "genre",
  "ranking",
];

export class SnsPostHistoryJsonError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "SnsPostHistoryJsonError";
    this.status = status;
  }
}

function isSnsPostHistoryEntry(value: unknown): value is SnsPostHistoryEntry {
  if (!value || typeof value !== "object") return false;

  const record = value as SnsPostHistoryEntry;
  return (
    typeof record.id === "string" &&
    record.id.trim().length > 0 &&
    typeof record.postedAt === "string" &&
    typeof record.postType === "string" &&
    VALID_POST_TYPES.includes(record.postType) &&
    typeof record.postText === "string"
  );
}

function extractHistoryArray(parsed: unknown): SnsPostHistoryEntry[] {
  if (Array.isArray(parsed)) {
    return parsed.filter(isSnsPostHistoryEntry);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new SnsPostHistoryJsonError(
      "sns-post-history.json の形式が不正です。",
    );
  }

  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    throw new SnsPostHistoryJsonError(
      "sns-post-history.json の形式が不正です。",
    );
  }

  return items.filter(isSnsPostHistoryEntry);
}

export function parseSnsPostHistoryJson(raw: string): SnsPostHistoryEntry[] {
  if (!raw.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SnsPostHistoryJsonError(
      "sns-post-history.json の JSON が不正です。",
    );
  }

  return extractHistoryArray(parsed);
}

export function serializeSnsPostHistory(
  records: SnsPostHistoryEntry[],
): string {
  return `${JSON.stringify(records, null, 2)}\n`;
}
