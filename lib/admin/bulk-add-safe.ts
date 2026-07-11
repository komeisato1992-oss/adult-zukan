import type { DmmItem } from "@/lib/dmm/types";

/** FANZA content_id / product_id の許容形式（英数字・ハイフン・アンダースコア） */
const IMPORT_CANDIDATE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export type BulkAddInvalidCandidate = {
  contentId: string;
  productId?: string;
  title?: string;
  reason: string;
  stage: string;
};

export function safeParseUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getCandidateContentId(
  candidate: Pick<DmmItem, "content_id" | "product_id"> & {
    contentId?: string;
    productId?: string;
  },
): string {
  return String(
    candidate.content_id ?? candidate.contentId ?? candidate.product_id ?? candidate.productId ?? "",
  ).trim();
}

export function isValidImportCandidateId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return false;
  return IMPORT_CANDIDATE_ID_PATTERN.test(trimmed);
}

export function validateCandidateUrls(item: DmmItem): BulkAddInvalidCandidate | null {
  const contentId = getCandidateContentId(item);

  for (const field of ["URL", "affiliateURL"] as const) {
    const raw = item[field];
    if (typeof raw !== "string" || !raw.trim()) continue;

    if (!safeParseUrl(raw)) {
      return {
        contentId,
        productId: item.product_id,
        title: item.title,
        reason: `invalid ${field}`,
        stage: "URL validation",
      };
    }
  }

  return null;
}

export function validateCandidateIdentity(
  item: DmmItem,
  contentIdOverride?: string,
): BulkAddInvalidCandidate | null {
  const contentId = (contentIdOverride ?? getCandidateContentId(item)).trim();

  if (!contentId) {
    return {
      contentId: "",
      productId: item.product_id,
      title: item.title,
      reason: "missing content_id",
      stage: "ID validation",
    };
  }

  if (!isValidImportCandidateId(contentId)) {
    return {
      contentId,
      productId: item.product_id,
      title: item.title,
      reason: "invalid content_id format",
      stage: "ID validation",
    };
  }

  if (item.product_id?.trim() && !isValidImportCandidateId(item.product_id)) {
    return {
      contentId,
      productId: item.product_id,
      title: item.title,
      reason: "invalid product_id format",
      stage: "ID validation",
    };
  }

  const urlIssue = validateCandidateUrls(item);
  if (urlIssue) {
    return urlIssue;
  }

  return null;
}

export type ParsedJsonResponse<T> =
  | { ok: true; data: T; rawText: string; status: number }
  | { ok: false; error: Error; rawText: string; status: number };

/** Safari は JSON パース失敗時に "The string did not match the expected pattern." を返す */
export async function parseJsonResponseBody<T>(
  response: Response,
): Promise<ParsedJsonResponse<T>> {
  const rawText = await response.text();
  const status = response.status;

  if (!rawText.trim()) {
    return {
      ok: false,
      status,
      rawText,
      error: new Error(
        `サーバーから空の応答が返されました（HTTP ${status}）。タイムアウトやサーバークラッシュの可能性があります。`,
      ),
    };
  }

  try {
    return {
      ok: true,
      status,
      rawText,
      data: JSON.parse(rawText) as T,
    };
  } catch (parseError) {
    const parseMessage =
      parseError instanceof Error ? parseError.message : String(parseError);

    return {
      ok: false,
      status,
      rawText,
      error: new Error(
        `サーバー応答のJSON解析に失敗しました（HTTP ${status}）: ${parseMessage}`,
      ),
    };
  }
}

export function formatBulkAddUserError(
  error: unknown,
  context?: {
    stage?: string;
    contentId?: string;
    rawMessage?: string;
  },
): string {
  const rawMessage =
    context?.rawMessage ??
    (error instanceof Error ? error.message : String(error));

  const isSafariJsonPattern =
    rawMessage.includes("The string did not match the expected pattern") ||
    rawMessage.includes("サーバーから空の応答") ||
    rawMessage.includes("サーバー応答のJSON解析に失敗");

  if (isSafariJsonPattern) {
    return "一括追加処理中にサーバー応答の解析に失敗しました。処理がタイムアウトしたか、サーバーが異常終了した可能性があります。しばらく待って再試行してください。";
  }

  if (rawMessage.includes("invalid content_id") || rawMessage.includes("ID validation")) {
    return "一括追加処理中に不正なデータが見つかりました。無効な候補を除外して再試行してください。";
  }

  return rawMessage || "一括追加に失敗しました。";
}

export function logBulkAddServerError(
  stage: string,
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  console.error("[bulk-add] failed", {
    stage,
    error,
    name: error instanceof Error ? error.name : undefined,
    message: error instanceof Error ? error.message : undefined,
    stack: error instanceof Error ? error.stack : undefined,
    ...extra,
  });
}
