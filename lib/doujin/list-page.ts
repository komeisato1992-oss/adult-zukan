import "server-only";

import {
  getDoujinCircleList,
  getDoujinGenreList,
  getDoujinPublicWorks,
} from "@/lib/doujin/catalog";
import {
  DOUJIN_PRODUCT_FORMAT_LABELS,
  DOUJIN_PRODUCT_FORMATS,
  isDoujinProductFormat,
  type DoujinProductFormat,
} from "@/lib/doujin/product-format";
import {
  DOUJIN_WORKS_DEFAULT_PER_PAGE,
  DOUJIN_WORKS_DEFAULT_SORT,
  filterDoujinWorksByQuery,
  parseDoujinWorkSortParam,
  sortDoujinWorksList,
  type DoujinFilterOption,
  type DoujinWorksListQueryState,
} from "@/lib/doujin/list-filters";
import { paginateItems, parsePageParam } from "@/lib/pagination";

export function getDoujinWorksListPageData(query: DoujinWorksListQueryState) {
  const allWorks = getDoujinPublicWorks();
  const filtered = filterDoujinWorksByQuery(allWorks, query);
  const sort = parseDoujinWorkSortParam(query.sort);
  const sorted = sortDoujinWorksList(filtered, sort);
  const page = parsePageParam(query.page);
  const paginated = paginateItems(
    sorted,
    page,
    DOUJIN_WORKS_DEFAULT_PER_PAGE,
  );

  const genreOptions: DoujinFilterOption[] = getDoujinGenreList().map(
    (genre) => ({
      value: genre.id,
      label: genre.name,
      count: genre.workCount,
    }),
  );

  const circleOptions: DoujinFilterOption[] = getDoujinCircleList().map(
    (circle) => ({
      value: circle.id,
      label: circle.name,
      count: circle.workCount,
    }),
  );

  const formatCounts = new Map<DoujinProductFormat, number>();
  for (const work of allWorks) {
    if (!isDoujinProductFormat(work.productFormatNormalized)) continue;
    formatCounts.set(
      work.productFormatNormalized,
      (formatCounts.get(work.productFormatNormalized) ?? 0) + 1,
    );
  }
  const formatOptions: DoujinFilterOption[] = DOUJIN_PRODUCT_FORMATS.filter(
    (format) => (formatCounts.get(format) ?? 0) > 0,
  ).map((format) => ({
    value: format,
    label: DOUJIN_PRODUCT_FORMAT_LABELS[format],
    count: formatCounts.get(format) ?? 0,
  }));

  const yearSet = new Set<string>();
  for (const work of allWorks) {
    const year = work.releaseDate?.slice(0, 4);
    if (year && /^\d{4}$/.test(year)) yearSet.add(year);
  }
  const yearOptions = [...yearSet].sort((a, b) => b.localeCompare(a));

  return {
    works: paginated.items,
    totalItems: paginated.totalItems,
    totalPages: paginated.totalPages,
    currentPage: paginated.currentPage,
    pageSize: paginated.pageSize,
    sort,
    defaultSort: DOUJIN_WORKS_DEFAULT_SORT,
    genreOptions,
    circleOptions,
    formatOptions,
    yearOptions,
  };
}
