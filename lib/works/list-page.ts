import "server-only";

import { filterDisplayableItems } from "@/lib/dmm/filter";
import { isWorkOnSale, isWorksListSaleQuery } from "@/lib/dmm/sale-price";
import type { DmmItem } from "@/lib/dmm/types";
import { paginateItems, parsePageParam, WORKS_LIST_PAGE_SIZE } from "@/lib/pagination";
import { mapPageItemsToWorkCards } from "@/lib/works/paginated-work-list";
import type { WorkListCardItem } from "@/lib/works/work-list-card-item";
import {
  buildWorkFilterEntries,
  filterWorkEntriesByQuery,
  getWorkFilterOptionsFromEntries,
  type WorkFilterOption,
  type WorksListQueryState,
} from "@/lib/works/list-filters";
import {
  buildCatalogOrderMap,
  getWorksSortOptions,
  parseWorkSortParam,
  SALE_DEFAULT_WORK_SORT,
  sortWorks,
  type WorkSortOption,
} from "@/lib/works/sort";

export type WorksListPageData = {
  pageItems: WorkListCardItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  genreOptions: WorkFilterOption[];
  makerOptions: WorkFilterOption[];
  sortOptions: WorkSortOption[];
};

function resolveWorksListSort(
  query: WorksListQueryState,
  isSalePage: boolean,
) {
  if (isSalePage && !query.sort?.trim()) {
    return SALE_DEFAULT_WORK_SORT;
  }

  return parseWorkSortParam(query.sort);
}

export function parseWorksListQueryState(params: {
  q?: string;
  sale?: string;
  filter?: string;
  sort?: string;
  page?: string;
  genre?: string;
  genres?: string;
  maker?: string;
  makers?: string;
  price?: string;
  date?: string;
}): WorksListQueryState {
  return {
    q: params.q,
    sale: params.sale,
    filter: params.filter,
    sort: params.sort,
    genre: params.genre,
    genres: params.genres,
    maker: params.maker,
    makers: params.makers,
    price: params.price ?? "all",
    date: params.date ?? "all",
    page: params.page ?? "1",
  };
}

export async function getWorksListPageData(
  catalog: DmmItem[],
  query: WorksListQueryState,
): Promise<WorksListPageData> {
  const isSalePage = isWorksListSaleQuery(query);
  const displayableItems = filterDisplayableItems(catalog);
  const filterEntries = buildWorkFilterEntries(displayableItems);
  const entriesForOptions = isSalePage
    ? filterEntries.filter((entry) => isWorkOnSale(entry.item))
    : filterEntries;
  const { genreOptions, makerOptions } =
    getWorkFilterOptionsFromEntries(entriesForOptions);
  const filtered = filterWorkEntriesByQuery(filterEntries, query);
  const currentSort = resolveWorksListSort(query, isSalePage);
  const catalogOrder = buildCatalogOrderMap(catalog);
  const sorted = sortWorks(filtered, currentSort, { catalogOrder });
  const currentPage = parsePageParam(query.page);
  const pagination = paginateItems(sorted, currentPage, WORKS_LIST_PAGE_SIZE);

  // 一覧1画面分だけ DB の変動情報を一括取得してマージ
  const { mergeLiveStatusIntoItems } = await import(
    "@/lib/dmm/work-live-status"
  );
  const pageWithLive = await mergeLiveStatusIntoItems(pagination.items);

  return {
    pageItems: mapPageItemsToWorkCards(pageWithLive, {
      includeSaleInfo: isSalePage,
    }),
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    genreOptions,
    makerOptions,
    sortOptions: getWorksSortOptions(filtered, {
      includeDiscountSort: isSalePage,
    }),
  };
}
