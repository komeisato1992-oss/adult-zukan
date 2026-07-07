import type { DmmItem } from "@/lib/dmm/types";

const HTML_ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** HTMLタグを除去し、改行を保持する */
export function stripHtmlTags(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITY_MAP[entity] ?? entity)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickDescription(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = stripHtmlTags(value);
  return normalized || undefined;
}

function getSampleImageComment(item: DmmItem): string | undefined {
  const sample = item.sampleImageURL as
    | (NonNullable<DmmItem["sampleImageURL"]> & { sampleImageComment?: string })
    | undefined;
  return pickDescription(sample?.sampleImageComment);
}

/** DMM / FANZA API レスポンスおよびスナップショット上の説明文を取得 */
export function getDmmItemDescription(item: DmmItem): string | undefined {
  const raw = item as DmmItem & Record<string, unknown>;
  const itemInfo = item.iteminfo as Record<string, unknown> | undefined;

  return (
    pickDescription(item.description) ??
    pickDescription(item.comment) ??
    pickDescription(raw.description) ??
    pickDescription(raw.comment) ??
    pickDescription(raw.content) ??
    pickDescription(itemInfo?.comment) ??
    pickDescription(itemInfo?.description) ??
    getSampleImageComment(item) ??
    undefined
  );
}

/** タイトル下の短い抜粋（2〜3行相当） */
export function getDmmDescriptionTeaser(
  description: string,
  maxLength = 120,
): string {
  const singleLine = description.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 1)}…`;
}
