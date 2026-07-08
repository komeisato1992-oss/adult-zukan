import "server-only";

import { pickAlternativeComparePair } from "@/lib/admin/sns-compare-pairs";
import { loadSnsPostHistory } from "@/lib/admin/sns-post-history-store";
import { buildHistoryExclusions } from "@/lib/admin/sns-post-history-rules";
import {
  buildActressPost,
  buildComparePost,
  buildGenrePost,
  buildRankingPost,
  buildRecommendedWorkPost,
} from "@/lib/admin/sns-posts";
import type {
  SnsPostMeta,
  SnsPostType,
  SnsRankingVariant,
  SnsScheduledPost,
} from "@/lib/admin/sns-types";
import { getCatalogItems } from "@/lib/dmm/catalog-entities";
import { getDmmItemActressNameList } from "@/lib/dmm/display";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import { getRankedActresses, getRankedGenres } from "@/lib/dmm/home-sections";
import type { DmmItem } from "@/lib/dmm/types";

const RANKING_VARIANTS: SnsRankingVariant[] = [
  "popular",
  "new",
  "sale",
  "random",
];

export class SnsRegenerateError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SnsRegenerateError";
    this.status = status;
  }
}

function pickRandomItem<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function pickAlternativeRecommendedWork(
  items: DmmItem[],
  excludeContentId?: string,
  excludedContentIds?: Set<string>,
): DmmItem | null {
  const eligible = filterDisplayableItems(items).filter((item) => {
    if (excludeContentId && item.content_id === excludeContentId) {
      return false;
    }
    if (excludedContentIds?.has(item.content_id)) {
      return false;
    }
    return true;
  });

  const withActress = eligible.filter(
    (item) => getDmmItemActressNameList(item).length > 0,
  );

  return pickRandomItem(withActress.length > 0 ? withActress : eligible);
}

function pickAlternativeActress(
  items: DmmItem[],
  excludeActressName?: string,
  excludedActressNames?: Set<string>,
) {
  const ranked = getRankedActresses(items, 100).filter(
    (actress) =>
      actress.workCount > 0 &&
      (!excludeActressName || actress.name !== excludeActressName) &&
      !excludedActressNames?.has(actress.name),
  );

  const withImage = ranked.filter((actress) => actress.imageUrl);
  return pickRandomItem(withImage.length > 0 ? withImage : ranked);
}

function pickAlternativeGenre(
  items: DmmItem[],
  excludeGenreSlug?: string,
  excludedGenreNames?: Set<string>,
) {
  const ranked = getRankedGenres(items, 100).filter(
    (genre) =>
      genre.workCount > 0 &&
      (!excludeGenreSlug || genre.slug !== excludeGenreSlug) &&
      !excludedGenreNames?.has(genre.name),
  );

  return pickRandomItem(ranked);
}

function pickAlternativeRankingVariant(
  excludeVariant?: SnsRankingVariant,
): SnsRankingVariant {
  const alternatives = RANKING_VARIANTS.filter(
    (variant) => variant !== excludeVariant,
  );

  return pickRandomItem(alternatives) ?? "popular";
}

export async function regenerateSnsPost(
  type: SnsPostType,
  meta?: SnsPostMeta,
): Promise<Pick<SnsScheduledPost, "body" | "compareWorks" | "compareUrl" | "meta">> {
  const items = await getCatalogItems();
  const { records: history } = await loadSnsPostHistory();
  const exclusions = buildHistoryExclusions(history);

  if (type === "recommended-work") {
    const work = pickAlternativeRecommendedWork(
      items,
      meta?.contentId,
      exclusions.excludedContentIds,
    );
    if (!work) {
      throw new SnsRegenerateError("別案のおすすめ作品が見つかりませんでした。");
    }

    return {
      body: buildRecommendedWorkPost(work),
      meta: { contentId: work.content_id },
    };
  }

  if (type === "compare") {
    const pair = pickAlternativeComparePair(
      items,
      meta?.compareContentIds,
      exclusions.excludedCompareKeys,
    );
    if (!pair) {
      throw new SnsRegenerateError("別案の比較ペアが見つかりませんでした。");
    }

    const { body, compareUrl } = buildComparePost(pair[0], pair[1]);
    return {
      body,
      compareWorks: pair,
      compareUrl,
      meta: {
        compareContentIds: [pair[0].contentId, pair[1].contentId],
      },
    };
  }

  if (type === "actress") {
    const actress = pickAlternativeActress(
      items,
      meta?.actressName,
      exclusions.excludedActressNames,
    );
    if (!actress) {
      throw new SnsRegenerateError("別案の女優が見つかりませんでした。");
    }

    return {
      body: buildActressPost(actress.name, actress.workCount),
      meta: { actressName: actress.name },
    };
  }

  if (type === "genre") {
    const genre = pickAlternativeGenre(
      items,
      meta?.genreSlug,
      exclusions.excludedGenreNames,
    );
    if (!genre) {
      throw new SnsRegenerateError("別案のジャンルが見つかりませんでした。");
    }

    return {
      body: buildGenrePost(genre.name, genre.slug, genre.workCount),
      meta: { genreSlug: genre.slug },
    };
  }

  if (type === "ranking") {
    const variant = pickAlternativeRankingVariant(meta?.rankingVariant);
    return {
      body: buildRankingPost(items, variant),
      meta: { rankingVariant: variant },
    };
  }

  throw new SnsRegenerateError("この投稿タイプは別案更新に対応していません。");
}
