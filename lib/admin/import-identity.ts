import { safeParseUrl } from "@/lib/admin/bulk-add-safe";
import { normalizeImportContentId } from "@/lib/admin/import-candidate-mapper";
import type { DmmItem } from "@/lib/dmm/types";

/** 品番・ID比較用：大文字小文字・ハイフン・空白・全半角差を吸収 */
export function normalizeWorkCode(value: string | undefined | null): string {
  if (!value) return "";

  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000-]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeWorkTitle(value: string | undefined | null): string {
  if (!value) return "";

  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, " ");
}

export function normalizeWorkUrl(value: string | undefined | null): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  const parsed = safeParseUrl(trimmed);
  if (!parsed) {
    return trimmed.toLowerCase();
  }

  return `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
}

/** content_id から品番相当を抽出（例: h_491start00319 → start00319） */
export function extractProductCode(contentId: string): string {
  const normalized = normalizeImportContentId(contentId);
  if (!normalized) return "";

  const withoutPrefix = normalized.replace(/^[a-z0-9]+_/, "");
  return normalizeWorkCode(withoutPrefix || normalized);
}

export type WorkIdentityKeys = {
  contentId: string;
  productId: string;
  productCode: string;
  url: string;
  title: string;
  allKeys: string[];
};

export function buildWorkIdentityKeys(item: Pick<DmmItem, "content_id" | "product_id" | "URL" | "title">): WorkIdentityKeys {
  const contentId = normalizeImportContentId(item.content_id);
  const productId = normalizeImportContentId(item.product_id ?? "");
  const productCode = extractProductCode(contentId || productId);
  const url = normalizeWorkUrl(item.URL);
  const title = normalizeWorkTitle(item.title);

  const allKeys = new Set<string>();
  if (contentId) allKeys.add(`cid:${contentId}`);
  if (productId) allKeys.add(`pid:${productId}`);
  if (productCode) allKeys.add(`code:${productCode}`);
  if (url) allKeys.add(`url:${url}`);
  if (title) allKeys.add(`title:${title}`);

  return {
    contentId,
    productId,
    productCode,
    url,
    title,
    allKeys: [...allKeys],
  };
}

export function keysMatchAny(
  keys: string[],
  known: Set<string>,
): boolean {
  return keys.some((key) => known.has(key));
}
