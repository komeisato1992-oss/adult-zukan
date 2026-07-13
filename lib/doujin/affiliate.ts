import type { DoujinWork } from "@/lib/doujin/types";

/**
 * FANZA同人アフィリエイトURL。
 * 保存済み affiliateUrl を優先（サーバー側で生成済み）。
 */
export function buildDoujinAffiliateUrl(
  work: Pick<DoujinWork, "id" | "affiliateUrl">,
): string {
  const url = work.affiliateUrl?.trim();
  if (!url || url === "#") return "";
  return url;
}

export function isValidDoujinAffiliateUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed !== "" && trimmed !== "#";
}
