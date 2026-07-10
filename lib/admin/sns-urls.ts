import { buildSiteUrl } from "@/lib/constants";
import type { SnsScheduledPost } from "@/lib/admin/sns-types";

/** URLが取得できない場合のフォールバック（TOP） */
export function buildSnsFallbackUrl(): string {
  return buildSiteUrl();
}

/** 作品詳細ページURL。content_id がなければ TOP */
export function buildSnsWorkPostUrl(contentId?: string | null): string {
  const trimmed = contentId?.trim();
  if (!trimmed) return buildSnsFallbackUrl();
  return buildSiteUrl(`/works/${trimmed}`);
}

/** 比較ページURL */
export function buildSnsComparePostUrl(
  contentIdA?: string | null,
  contentIdB?: string | null,
): string {
  const a = contentIdA?.trim();
  const b = contentIdB?.trim();
  if (!a || !b) return buildSnsFallbackUrl();
  return `${buildSiteUrl("/compare")}?ids=${a},${b}`;
}

/** 投稿カード・履歴用にリンクURLを解決 */
export function buildSnsPostUrl(
  post: Pick<SnsScheduledPost, "type" | "compareUrl" | "meta">,
): string {
  if (post.type === "compare" && post.compareUrl?.trim()) {
    return post.compareUrl.trim();
  }

  if (post.meta?.contentId?.trim()) {
    return buildSnsWorkPostUrl(post.meta.contentId);
  }

  if (post.type === "compare" && post.meta?.compareContentIds) {
    const [a, b] = post.meta.compareContentIds;
    return buildSnsComparePostUrl(a, b);
  }

  return buildSnsFallbackUrl();
}
