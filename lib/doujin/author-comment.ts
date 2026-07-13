import "server-only";

import { stripHtmlTags } from "@/lib/dmm/description";
import type { DoujinStoredWork } from "@/lib/doujin/types";

const DIRECT_COMMENT_KEYS = [
  "authorComment",
  "workComment",
  "description",
  "comment",
  "summary",
  "story",
  "caption",
  "introduction",
  "content",
] as const;

const RAW_COMMENT_KEYS = [
  "authorComment",
  "workComment",
  "description",
  "comment",
  "summary",
  "story",
  "caption",
  "introduction",
  "content",
  "outline",
  "synopsis",
] as const;

function pickCommentString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = stripHtmlTags(value);
  return cleaned || undefined;
}

function pickFromRecord(
  record: Record<string, unknown> | undefined,
  keys: readonly string[],
): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const picked = pickCommentString(record[key]);
    if (picked) return picked;
  }
  return undefined;
}

/**
 * 保存済み作品から作者コメント相当の説明文を抽出する。
 * rawApiResponse 全体は返さず、文字列のみ返す。
 *
 * 優先順位:
 * 1. authorComment / workComment / description / comment / summary 等の直下フィールド
 * 2. rawApiResponse 内の同名フィールド
 * 3. rawApiResponse.iteminfo 内の同名フィールド
 * 4. sampleImageURL.sampleImageComment 等
 */
export function extractDoujinAuthorComment(
  work: DoujinStoredWork,
): string | undefined {
  const direct = work as DoujinStoredWork & Record<string, unknown>;
  const fromDirect = pickFromRecord(direct, DIRECT_COMMENT_KEYS);
  if (fromDirect) return fromDirect;

  const raw = work.rawApiResponse;
  if (!raw || typeof raw !== "object") return undefined;

  const fromRaw = pickFromRecord(raw, RAW_COMMENT_KEYS);
  if (fromRaw) return fromRaw;

  const iteminfo = raw.iteminfo;
  if (iteminfo && typeof iteminfo === "object" && !Array.isArray(iteminfo)) {
    const fromIteminfo = pickFromRecord(
      iteminfo as Record<string, unknown>,
      RAW_COMMENT_KEYS,
    );
    if (fromIteminfo) return fromIteminfo;
  }

  const sample = raw.sampleImageURL;
  if (sample && typeof sample === "object" && !Array.isArray(sample)) {
    const sampleRecord = sample as Record<string, unknown>;
    const fromSample =
      pickCommentString(sampleRecord.sampleImageComment) ??
      pickCommentString(sampleRecord.comment);
    if (fromSample) return fromSample;
  }

  return undefined;
}
