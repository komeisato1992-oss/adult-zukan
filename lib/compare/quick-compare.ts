import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import {
  getHighSimilarityCandidates,
  isEligibleRandomCompareWork,
  selectRandomSeedWork,
  selectSimilarWork,
} from "@/lib/compare/random-pair";
import type {
  QuickCompareResult,
  QuickCompareSiteType,
} from "@/lib/compare/quick-compare-types";
import { buildComparePageHref } from "@/lib/compare/urls";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import { isWorkPubliclyVisible } from "@/lib/dmm/catalog-visibility";
import type { DmmItem } from "@/lib/dmm/types";
import { buildDoujinComparePageHref } from "@/lib/doujin/compare/urls";
import {
  getDoujinPopularWorks,
  getDoujinPublicWorks,
  getDoujinRandomComparePair,
} from "@/lib/doujin/catalog";
import {
  comparePopularWorks,
  hasPopularityData,
} from "@/lib/works/popularity";

export type {
  QuickCompareResult,
  QuickCompareSelectionType,
  QuickCompareSiteType,
} from "@/lib/compare/quick-compare-types";

export type GetQuickCompareItemsOptions = {
  siteType: QuickCompareSiteType;
  count?: number;
  /** 成人図鑑: 呼び出し元で取得済みカタログを渡すと再取得を避けられる */
  adultCatalog?: DmmItem[];
};

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function adultFallback(): QuickCompareResult {
  return {
    workIds: [],
    href: "/compare",
    selectionType: "fallback",
  };
}

function doujinFallback(): QuickCompareResult {
  return {
    workIds: [],
    href: "/doujin/compare",
    selectionType: "fallback",
  };
}

function getAdultQuickCompareItems(
  catalog: DmmItem[],
  count: number,
): QuickCompareResult {
  const eligible = filterDisplayableItems(catalog)
    .filter(isWorkPubliclyVisible)
    .filter(isEligibleRandomCompareWork);

  if (eligible.length < count) {
    return adultFallback();
  }

  // 優先1: 類似度の高い組み合わせ
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seed = selectRandomSeedWork(eligible);
    if (!seed) break;

    const candidates = getHighSimilarityCandidates(seed, eligible);
    const matched = selectSimilarWork(candidates);
    if (!matched) continue;

    const workIds = [seed.content_id, matched.item.content_id].slice(0, count);
    if (workIds.length < count || workIds[0] === workIds[1]) continue;

    return {
      workIds,
      href: buildComparePageHref(workIds),
      selectionType: "similar",
    };
  }

  // 優先2: ランキング上位
  const popular = eligible
    .filter(hasPopularityData)
    .sort(comparePopularWorks);
  if (popular.length >= count) {
    const workIds = popular.slice(0, count).map((item) => item.content_id);
    if (new Set(workIds).size === count) {
      return {
        workIds,
        href: buildComparePageHref(workIds),
        selectionType: "ranking",
      };
    }
  }

  // 優先3: 公開中作品からランダム
  const shuffled = shuffleItems(eligible);
  const workIds = shuffled.slice(0, count).map((item) => item.content_id);
  if (new Set(workIds).size === count) {
    return {
      workIds,
      href: buildComparePageHref(workIds),
      selectionType: "random",
    };
  }

  return adultFallback();
}

function getDoujinQuickCompareItems(count: number): QuickCompareResult {
  // 優先1: 既存のランダム比較ペア（類似・属性寄りは将来強化）
  const pair = getDoujinRandomComparePair();
  if (pair && pair[0].id !== pair[1].id) {
    const workIds = [pair[0].id, pair[1].id].slice(0, count);
    if (workIds.length >= count) {
      return {
        workIds,
        href: buildDoujinComparePageHref(workIds),
        selectionType: "similar",
      };
    }
  }

  // 優先2: 人気作品上位
  const popular = getDoujinPopularWorks(Math.max(count, 8));
  if (popular.length >= count) {
    const workIds = popular.slice(0, count).map((work) => work.id);
    if (new Set(workIds).size === count) {
      return {
        workIds,
        href: buildDoujinComparePageHref(workIds),
        selectionType: "ranking",
      };
    }
  }

  // 優先3: 公開中からランダム
  const publicWorks = shuffleItems(getDoujinPublicWorks());
  if (publicWorks.length >= count) {
    const workIds = publicWorks.slice(0, count).map((work) => work.id);
    if (new Set(workIds).size === count) {
      return {
        workIds,
        href: buildDoujinComparePageHref(workIds),
        selectionType: "random",
      };
    }
  }

  return doujinFallback();
}

/**
 * TOP「比較機能を見る」用の比較候補を取得する。
 * 成人図鑑と同人図鑑で作品が混ざらないよう siteType で分離する。
 */
export function getQuickCompareItems(
  options: GetQuickCompareItemsOptions,
): QuickCompareResult {
  noStore();

  const count = options.count ?? 2;
  if (count < 2) {
    return options.siteType === "doujin" ? doujinFallback() : adultFallback();
  }

  if (options.siteType === "doujin") {
    return getDoujinQuickCompareItems(count);
  }

  const catalog = options.adultCatalog;
  if (!catalog || catalog.length < 2) {
    return adultFallback();
  }

  return getAdultQuickCompareItems(catalog, count);
}
