import "server-only";

import { getActressDetailPath } from "@/lib/actresses/slug";
import { pickComparePairs } from "@/lib/admin/sns-compare-pairs";
import { loadSnsPostHistory } from "@/lib/admin/sns-post-history-store";
import { buildHistoryExclusions } from "@/lib/admin/sns-post-history-rules";
import {
  actressNamesToHashtags,
  buildHashtagLine,
  nameToHashtag,
  SNS_BASE_HASHTAGS,
  SNS_COMPARE_HASHTAGS,
  SNS_RANKING_HASHTAGS,
} from "@/lib/admin/sns-hashtags";
import {
  SNS_DAILY_SCHEDULE,
  type SnsCompareWorkMini,
  type SnsRankingVariant,
  type SnsScheduledPost,
} from "@/lib/admin/sns-types";
import { buildSiteUrl } from "@/lib/constants";
import { getGenreDetailPath } from "@/lib/entities/paths";
import { getCatalogItems } from "@/lib/dmm/catalog-entities";
import {
  getDmmItemActressNameList,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import {
  getNewWorks,
  getPopularWorks,
  getRankedActresses,
  getRankedGenres,
  getSaleWorks,
} from "@/lib/dmm/home-sections";
import type { DmmItem } from "@/lib/dmm/types";

const RANKING_URL = "https://adult-zukan.jp/ranking";

export function buildSnsPostUrl(
  post: Pick<SnsScheduledPost, "type" | "compareUrl" | "meta">,
): string | undefined {
  if (post.compareUrl) return post.compareUrl;
  if (post.meta?.contentId) {
    return buildSiteUrl(`/works/${post.meta.contentId}`);
  }
  if (post.meta?.actressName) {
    return buildSiteUrl(getActressDetailPath(post.meta.actressName));
  }
  if (post.meta?.genreSlug) {
    return buildSiteUrl(getGenreDetailPath(post.meta.genreSlug));
  }
  if (post.type === "ranking") return RANKING_URL;
  return undefined;
}

function pickFromPool<T>(items: T[], fallback: T[]): T | undefined {
  const pool = items.length > 0 ? items : fallback;
  if (pool.length === 0) return undefined;
  return pool[getDayOffset(pool.length)] ?? pool[0];
}

function getDayOffset(length: number): number {
  if (length <= 0) return 0;

  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  return dayOfYear % length;
}

function buildCompareUrl(workA: SnsCompareWorkMini, workB: SnsCompareWorkMini): string {
  return `${buildSiteUrl("/compare")}?ids=${workA.contentId},${workB.contentId}`;
}

export function buildRecommendedWorkPost(item: DmmItem): string {
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

export function buildComparePost(
  workA: SnsCompareWorkMini,
  workB: SnsCompareWorkMini,
): { body: string; compareUrl: string } {
  const compareUrl = buildCompareUrl(workA, workB);
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

export function buildActressPost(name: string, workCount: number): string {
  const actressUrl = buildSiteUrl(getActressDetailPath(name));
  const actressTag = nameToHashtag(name);
  const hashtags = buildHashtagLine([
    ...SNS_BASE_HASHTAGS,
    ...(actressTag ? [actressTag] : []),
  ]);

  return [
    "【人気女優紹介】💎",
    "",
    name,
    "",
    `掲載作品：${workCount}作品`,
    "",
    "出演作品をまとめてチェック👇",
    actressUrl,
    "",
    hashtags,
  ].join("\n");
}

export function buildGenrePost(name: string, slug: string, workCount: number): string {
  const genreUrl = buildSiteUrl(getGenreDetailPath(slug));
  const genreTag = nameToHashtag(name);
  const hashtags = buildHashtagLine([
    ...SNS_BASE_HASHTAGS,
    ...(genreTag ? [genreTag] : []),
  ]);

  return [
    "【ジャンルから探す】📚",
    "",
    name,
    "",
    `掲載作品：${workCount}作品`,
    "",
    "ジャンル別に作品を探す👇",
    genreUrl,
    "",
    hashtags,
  ].join("\n");
}

const RANKING_HEADINGS: Record<SnsRankingVariant, string> = {
  popular: "【人気作品ランキング】🏆",
  new: "【新着作品ランキング】🆕",
  sale: "【セール作品ランキング】💰",
  random: "【ランダムおすすめ】🎲",
};

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getRankingItems(
  items: DmmItem[],
  variant: SnsRankingVariant,
): DmmItem[] {
  switch (variant) {
    case "new":
      return getNewWorks(items, 100);
    case "sale":
      return getSaleWorks(items, 100);
    case "random":
      return shuffleItems(filterDisplayableItems(items));
    case "popular":
    default:
      return getPopularWorks(items, 100);
  }
}

function collectRankingActressHashtags(items: DmmItem[]): string[] {
  const tags: string[] = [];

  for (const item of items.slice(0, 3)) {
    tags.push(...actressNamesToHashtags(getDmmItemActressNameList(item).join("、")));
  }

  return tags;
}

export function buildRankingPost(
  items: DmmItem[],
  variant: SnsRankingVariant = "popular",
): string {
  const topWorks = filterDisplayableItems(getRankingItems(items, variant)).slice(
    0,
    3,
  );
  const hashtags = buildHashtagLine([
    ...SNS_RANKING_HASHTAGS,
    ...collectRankingActressHashtags(topWorks),
  ]);

  return [
    RANKING_HEADINGS[variant],
    "",
    "注目作品をランキングで確認できます✅",
    "",
    `1位：${topWorks[0]?.title ?? "-"}`,
    `2位：${topWorks[1]?.title ?? "-"}`,
    `3位：${topWorks[2]?.title ?? "-"}`,
    "",
    "ランキングはこちら👇",
    RANKING_URL,
    "",
    hashtags,
  ].join("\n");
}

export async function getSnsScheduledPosts(): Promise<SnsScheduledPost[]> {
  const items = await getCatalogItems();
  const displayable = filterDisplayableItems(items);
  const { records: history } = await loadSnsPostHistory();
  const exclusions = buildHistoryExclusions(history);
  const comparePairs = pickComparePairs(items, exclusions.excludedCompareKeys);
  let compareIndex = 0;

  const recommendedWork = pickFromPool(
    displayable.filter(
      (item) => !exclusions.excludedContentIds.has(item.content_id),
    ),
    displayable,
  );

  const rankedActresses = getRankedActresses(items, 20);
  const actress = pickFromPool(
    rankedActresses.filter(
      (entry) => !exclusions.excludedActressNames.has(entry.name),
    ),
    rankedActresses,
  );

  const rankedGenres = getRankedGenres(items, 20);
  const genre = pickFromPool(
    rankedGenres.filter(
      (entry) => !exclusions.excludedGenreNames.has(entry.name),
    ),
    rankedGenres,
  );

  return SNS_DAILY_SCHEDULE.map((entry) => {
    if (entry.type === "recommended-work" && recommendedWork) {
      return {
        slot: entry.slot,
        type: entry.type,
        typeLabel: entry.typeLabel,
        body: buildRecommendedWorkPost(recommendedWork),
        meta: { contentId: recommendedWork.content_id },
      };
    }

    if (entry.type === "compare") {
      const pair = comparePairs[compareIndex];
      compareIndex += 1;

      if (pair) {
        const { body, compareUrl } = buildComparePost(pair[0], pair[1]);
        return {
          slot: entry.slot,
          type: entry.type,
          typeLabel: entry.typeLabel,
          body,
          compareWorks: pair,
          compareUrl,
          meta: {
            compareContentIds: [pair[0].contentId, pair[1].contentId],
          },
        };
      }

      return {
        slot: entry.slot,
        type: entry.type,
        typeLabel: entry.typeLabel,
        body: [
          "【作品比較】🔍",
          "",
          "アダルト図鑑では、似ている作品を比較することができます。",
          "",
          "本日の比較候補を生成できませんでした。",
          "カタログデータを確認してください。",
          "",
          buildHashtagLine([...SNS_COMPARE_HASHTAGS]),
        ].join("\n"),
      };
    }

    if (entry.type === "actress" && actress) {
      return {
        slot: entry.slot,
        type: entry.type,
        typeLabel: entry.typeLabel,
        body: buildActressPost(actress.name, actress.workCount),
        meta: { actressName: actress.name },
      };
    }

    if (entry.type === "genre" && genre) {
      return {
        slot: entry.slot,
        type: entry.type,
        typeLabel: entry.typeLabel,
        body: buildGenrePost(genre.name, genre.slug, genre.workCount),
        meta: { genreSlug: genre.slug },
      };
    }

    if (entry.type === "ranking") {
      return {
        slot: entry.slot,
        type: entry.type,
        typeLabel: entry.typeLabel,
        body: buildRankingPost(items, "popular"),
        meta: { rankingVariant: "popular" },
      };
    }

    return {
      slot: entry.slot,
      type: entry.type,
      typeLabel: entry.typeLabel,
      body: "投稿候補を生成できませんでした。",
    };
  });
}
