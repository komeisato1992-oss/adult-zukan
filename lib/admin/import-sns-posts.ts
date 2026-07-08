import { getActressDetailPath } from "@/lib/actresses/slug";
import {
  actressNamesToHashtags,
  buildHashtagLine,
  nameToHashtag,
  SNS_BASE_HASHTAGS,
} from "@/lib/admin/sns-hashtags";
import { buildSiteUrl } from "@/lib/constants";
import {
  getDmmItemActressNameList,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";

export type ImportSnsPostType = "recommended-work" | "actress";

export const IMPORT_SNS_POST_TYPE_LABELS: Record<ImportSnsPostType, string> = {
  "recommended-work": "今日のおすすめ作品",
  actress: "人気女優紹介",
};

export function buildImportRecommendedWorkPost(item: DmmItem): string {
  const actressLine = getDmmItemActressNameList(item).join("、");
  const price = getDmmItemPrice(item);
  const workUrl = buildSiteUrl(`/works/${item.content_id}`);
  const hashtags = buildHashtagLine([
    ...SNS_BASE_HASHTAGS,
    ...actressNamesToHashtags(actressLine),
  ]);

  return [
    "【今日のおすすめ作品】✨",
    "",
    item.title,
    "",
    `女優：${actressLine || "-"}`,
    `価格：${price || "-"}`,
    "",
    "作品ページはこちら👇",
    workUrl,
    "",
    hashtags,
  ].join("\n");
}

export function buildImportActressPost(actressName: string): string {
  const actressUrl = buildSiteUrl(getActressDetailPath(actressName));
  const actressTag = nameToHashtag(actressName);
  const hashtags = buildHashtagLine([
    ...SNS_BASE_HASHTAGS,
    ...(actressTag ? [actressTag] : []),
  ]);

  return [
    "【人気女優紹介】💎",
    "",
    actressName,
    "",
    "アダルト図鑑では、出演作品をまとめてチェックできます。",
    "",
    "出演作品はこちら👇",
    actressUrl,
    "",
    hashtags,
  ].join("\n");
}

export function formatImportCatalogJson(item: DmmItem): string {
  return JSON.stringify(item, null, 2);
}
