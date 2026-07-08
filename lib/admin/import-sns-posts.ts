import { getActressDetailPath } from "@/lib/actresses/slug";
import {
  actressNamesToHashtags,
  buildHashtagLine,
  nameToHashtag,
  SNS_BASE_HASHTAGS,
  SNS_COMPARE_HASHTAGS,
} from "@/lib/admin/sns-hashtags";
import type { SnsCompareWorkMini } from "@/lib/admin/sns-types";
import { buildSiteUrl } from "@/lib/constants";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";

export type ImportSnsPostType = "recommended-work" | "compare" | "actress";

export const IMPORT_SNS_POST_TYPE_LABELS: Record<ImportSnsPostType, string> = {
  "recommended-work": "今日のおすすめ作品",
  compare: "比較投稿",
  actress: "人気女優紹介",
};

function toCompareWorkMini(item: DmmItem): SnsCompareWorkMini {
  return {
    contentId: item.content_id,
    title: item.title,
    imageUrl: getDmmItemImageUrl(item),
    actressNames: getDmmItemActressNameList(item).join("、"),
    price: getDmmItemPrice(item),
  };
}

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

function buildImportComparePostBody(
  workA: SnsCompareWorkMini,
  workB: SnsCompareWorkMini,
): { body: string; compareUrl: string } {
  const compareUrl = `${buildSiteUrl("/compare")}?ids=${workA.contentId},${workB.contentId}`;
  const hashtags = buildHashtagLine([
    ...SNS_COMPARE_HASHTAGS,
    ...actressNamesToHashtags(workA.actressNames),
    ...actressNamesToHashtags(workB.actressNames),
  ]);

  const body = [
    "【作品比較】🔍",
    "",
    "アダルト図鑑では、似ている作品を比較することができます。",
    "",
    "比較ページはこちら▼",
    compareUrl,
    "",
    `① ${workA.title}`,
    `女優：${workA.actressNames || "-"}`,
    `価格：${workA.price || "-"}`,
    "",
    `② ${workB.title}`,
    `女優：${workB.actressNames || "-"}`,
    `価格：${workB.price || "-"}`,
    "",
    hashtags,
  ].join("\n");

  return { body, compareUrl };
}

export function buildImportComparePost(
  workA: DmmItem,
  workB: DmmItem,
): {
  body: string;
  compareUrl: string;
  compareWorks: [SnsCompareWorkMini, SnsCompareWorkMini];
} {
  const compareWorks: [SnsCompareWorkMini, SnsCompareWorkMini] = [
    toCompareWorkMini(workA),
    toCompareWorkMini(workB),
  ];
  const { body, compareUrl } = buildImportComparePostBody(
    compareWorks[0],
    compareWorks[1],
  );
  return { body, compareUrl, compareWorks };
}

export function pickImportComparePair(items: DmmItem[]): [DmmItem, DmmItem] | null {
  const eligible = items.filter(
    (item) => getDmmItemActressNameList(item).length > 0 && getDmmItemPrice(item),
  );

  if (eligible.length >= 2) {
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  }

  if (items.length >= 2) {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  }

  return null;
}

export function pickImportActressName(items: DmmItem[]): string | null {
  const names = items.flatMap((item) => getDmmItemActressNameList(item));
  if (names.length === 0) return null;
  return names[Math.floor(Math.random() * names.length)] ?? null;
}

export function formatImportCatalogJson(item: DmmItem): string {
  return JSON.stringify(item, null, 2);
}
