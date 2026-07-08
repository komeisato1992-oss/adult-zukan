/** data/dmm/ 配下のインデックス JSON パス（リポジトリ相対） */
export const CATALOG_INDEX_PATHS = {
  actresses: "data/dmm/actresses.json",
  makers: "data/dmm/makers.json",
  labels: "data/dmm/labels.json",
  series: "data/dmm/series.json",
  genres: "data/dmm/genres.json",
  searchIndex: "data/dmm/search-index.json",
  ranking: "data/dmm/ranking-snapshot.json",
} as const;

export type CatalogIndexPathKey = keyof typeof CATALOG_INDEX_PATHS;

export const CATALOG_INDEX_PATH_LIST = Object.values(CATALOG_INDEX_PATHS);
