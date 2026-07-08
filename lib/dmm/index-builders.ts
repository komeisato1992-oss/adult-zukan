import "server-only";

import {
  getCatalogActresses,
  getCatalogGenres,
  getCatalogLabels,
  getCatalogMakers,
  getCatalogSeries,
  type CatalogActressEntity,
  type CatalogEntity,
  type CatalogLabelEntity,
  type CatalogSeriesEntity,
} from "@/lib/dmm/catalog-entities";
import {
  getRankedActresses,
  getRankedGenres,
  getRankedMakers,
  getRankedSeries,
  getSaleWorks,
  getPopularWorks,
  type RankedActress,
  type RankedNameCount,
} from "@/lib/dmm/home-sections";
import { CATALOG_INDEX_PATHS } from "@/lib/dmm/index-paths";
import { buildSearchText } from "@/lib/search/build-text";
import type { SearchIndexEntry } from "@/lib/search/index";
import type { DmmItem } from "@/lib/dmm/types";

export type IndexDocument<T> = {
  updatedAt: string;
  total: number;
  items: T;
};

export type RankingSnapshot = {
  updatedAt: string;
  popularContentIds: string[];
  saleContentIds: string[];
  rankedMakers: RankedNameCount[];
  rankedSeries: RankedNameCount[];
  rankedGenres: RankedNameCount[];
  rankedActresses: RankedActress[];
};

export type RebuiltCatalogIndexes = {
  actresses: CatalogActressEntity[];
  makers: CatalogEntity[];
  labels: CatalogLabelEntity[];
  series: CatalogSeriesEntity[];
  genres: CatalogEntity[];
  searchIndex: SearchIndexEntry[];
  ranking: RankingSnapshot;
};

export type SerializedCatalogIndexFile = {
  path: string;
  content: string;
};

export type IndexUpdateStats = {
  actressesAdded: number;
  makersAdded: number;
  labelsAdded: number;
  seriesAdded: number;
  genresAdded: number;
  searchIndexUpdated: boolean;
  rankingUpdated: boolean;
};

export class IndexRebuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndexRebuildError";
  }
}

function buildIndexDocument<T>(items: T): IndexDocument<T> {
  const list = Array.isArray(items) ? items : [];
  return {
    updatedAt: new Date().toISOString(),
    total: list.length,
    items,
  };
}

function serializeIndexDocument<T>(items: T): string {
  return `${JSON.stringify(buildIndexDocument(items), null, 2)}\n`;
}

function buildSearchIndex(items: DmmItem[]): SearchIndexEntry[] {
  return items.map((item) => ({
    contentId: item.content_id,
    searchText: buildSearchText(item),
  }));
}

function buildRankingSnapshot(items: DmmItem[]): RankingSnapshot {
  return {
    updatedAt: new Date().toISOString(),
    popularContentIds: getPopularWorks(items, 50).map((item) => item.content_id),
    saleContentIds: getSaleWorks(items, 50).map((item) => item.content_id),
    rankedMakers: getRankedMakers(items),
    rankedSeries: getRankedSeries(items),
    rankedGenres: getRankedGenres(items),
    rankedActresses: getRankedActresses(items),
  };
}

/** catalog 全体から各インデックスを再生成する（差分更新ではなくフル再構築） */
export function rebuildAllIndexes(catalogItems: DmmItem[]): RebuiltCatalogIndexes {
  try {
    return {
      actresses: getCatalogActresses(catalogItems),
      makers: getCatalogMakers(catalogItems),
      labels: getCatalogLabels(catalogItems),
      series: getCatalogSeries(catalogItems),
      genres: getCatalogGenres(catalogItems),
      searchIndex: buildSearchIndex(catalogItems),
      ranking: buildRankingSnapshot(catalogItems),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new IndexRebuildError(
      `関連インデックスの再生成に失敗しました: ${detail}`,
    );
  }
}

export function serializeCatalogIndexes(
  indexes: RebuiltCatalogIndexes,
): SerializedCatalogIndexFile[] {
  return [
    {
      path: CATALOG_INDEX_PATHS.actresses,
      content: serializeIndexDocument(indexes.actresses),
    },
    {
      path: CATALOG_INDEX_PATHS.makers,
      content: serializeIndexDocument(indexes.makers),
    },
    {
      path: CATALOG_INDEX_PATHS.labels,
      content: serializeIndexDocument(indexes.labels),
    },
    {
      path: CATALOG_INDEX_PATHS.series,
      content: serializeIndexDocument(indexes.series),
    },
    {
      path: CATALOG_INDEX_PATHS.genres,
      content: serializeIndexDocument(indexes.genres),
    },
    {
      path: CATALOG_INDEX_PATHS.searchIndex,
      content: serializeIndexDocument(indexes.searchIndex),
    },
    {
      path: CATALOG_INDEX_PATHS.ranking,
      content: `${JSON.stringify(indexes.ranking, null, 2)}\n`,
    },
  ];
}

function slugSet<T extends { slug: string }>(entries: T[]): Set<string> {
  return new Set(entries.map((entry) => entry.slug));
}

function countNewSlugs<T extends { slug: string }>(
  before: T[],
  after: T[],
): number {
  const previous = slugSet(before);
  let added = 0;

  for (const entry of after) {
    if (!previous.has(entry.slug)) {
      added += 1;
    }
  }

  return added;
}

export function compareIndexUpdateStats(
  before: RebuiltCatalogIndexes,
  after: RebuiltCatalogIndexes,
): IndexUpdateStats {
  return {
    actressesAdded: countNewSlugs(before.actresses, after.actresses),
    makersAdded: countNewSlugs(before.makers, after.makers),
    labelsAdded: countNewSlugs(before.labels, after.labels),
    seriesAdded: countNewSlugs(before.series, after.series),
    genresAdded: countNewSlugs(before.genres, after.genres),
    searchIndexUpdated:
      before.searchIndex.length !== after.searchIndex.length ||
      before.searchIndex.some(
        (entry, index) =>
          entry.contentId !== after.searchIndex[index]?.contentId,
      ),
    rankingUpdated: true,
  };
}

export function formatIndexUpdateStats(stats: IndexUpdateStats): string {
  const lines = [
    "関連データ更新：",
    `女優：+${stats.actressesAdded}`,
    `メーカー：+${stats.makersAdded}`,
    `レーベル：+${stats.labelsAdded}`,
    `シリーズ：+${stats.seriesAdded}`,
    `ジャンル：+${stats.genresAdded}`,
    `検索インデックス：${stats.searchIndexUpdated ? "更新完了" : "変更なし"}`,
    `ランキング/セール：${stats.rankingUpdated ? "更新完了" : "変更なし"}`,
  ];

  return lines.join("\n");
}
