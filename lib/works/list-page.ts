import "server-only";

import {
  readCommittedGenreIndex,
  readCommittedMakerIndex,
} from "@/lib/dmm/catalog-index-read";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import { paginateItems, parsePageParam, WORKS_LIST_PAGE_SIZE } from "@/lib/pagination";
import { mapPageItemsToWorkCards } from "@/lib/works/paginated-work-list";
import type { WorkListCardItem } from "@/lib/works/work-list-card-item";
import {
  buildWorkFilterEntries,
  filterWorkEntriesByQuery,
  type WorkFilterOption,
  type WorksListQueryState,
} from "@/lib/works/list-filters";
import {
  getWorksSortOptions,
  parseWorkSortParam,
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

function indexToFilterOptions(
  items: Array<{ name: string; workCount?: number }>,
): WorkFilterOption[] {
  return items.map((item) => ({
    label: item.name,
    value: item.name,
    count: item.workCount,
  }));
}

export function parseWorksListQueryState(params: {
  q?: string;
  sale?: string;
  filter?: string;
  sort?: string;
  page?: string;
  genre?: string;
  maker?: string;
  price?: string;
  date?: string;
}): WorksListQueryState {
  return {
    q: params.q,
    sale: params.sale,
    filter: params.filter,
    sort: params.sort,
    genre: params.genre,
    maker: params.maker,
    price: params.price ?? "all",
    date: params.date ?? "all",
    page: params.page ?? "1",
  };
}

export async function getWorksListPageData(
  catalog: DmmItem[],
  query: WorksListQueryState,
): Promise<WorksListPageData> {
  const displayableItems = filterDisplayableItems(catalog);
  const filterEntries = buildWorkFilterEntries(displayableItems);
  const filtered = filterWorkEntriesByQuery(filterEntries, query);
  const currentSort = parseWorkSortParam(query.sort);
  const sorted = sortWorks(filtered, currentSort);
  const currentPage = parsePageParam(query.page);
  const pagination = paginateItems(sorted, currentPage, WORKS_LIST_PAGE_SIZE);

  const [genres, makers] = await Promise.all([
    Promise.resolve(readCommittedGenreIndex()),
    Promise.resolve(readCommittedMakerIndex()),
  ]);

  return {
    pageItems: mapPageItemsToWorkCards(pagination.items),
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    genreOptions: indexToFilterOptions(genres),
    makerOptions: indexToFilterOptions(makers),
    sortOptions: getWorksSortOptions(displayableItems),
  };
}
