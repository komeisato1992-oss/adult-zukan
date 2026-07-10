import "server-only";

import { filterDisplayableItems } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import {
  CATALOG_DETAIL_PAGE_SIZE,
  paginateItems,
  parsePageParam,
  WORKS_LIST_PAGE_SIZE,
} from "@/lib/pagination";
import {
  DEFAULT_WORK_SORT,
  parseWorkSortParam,
  sortWorks,
  type WorkSortKey,
} from "@/lib/works/sort";
import {
  toWorkListCardItem,
  toWorkListCardItems,
  type WorkListCardItem,
} from "@/lib/works/work-list-card-item";

export type PaginatedWorkCardList = {
  pageItems: WorkListCardItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
};

export type PaginatedWorkListOptions = {
  page?: number | string;
  pageSize?: number;
  sort?: WorkSortKey;
};

function paginateToWorkCards(
  items: DmmItem[],
  options: PaginatedWorkListOptions,
  defaultPageSize: number,
): PaginatedWorkCardList {
  const pageSize = options.pageSize ?? defaultPageSize;
  const sort = options.sort ?? DEFAULT_WORK_SORT;
  const sorted = sortWorks(items, sort);
  const pagination = paginateItems(sorted, parsePageParam(options.page), pageSize);

  return {
    pageItems: toWorkListCardItems(pagination.items),
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    pageSize,
  };
}

export function getPaginatedWorkCardList(
  items: DmmItem[],
  options: PaginatedWorkListOptions = {},
): PaginatedWorkCardList {
  return paginateToWorkCards(items, options, CATALOG_DETAIL_PAGE_SIZE);
}

export function getPaginatedDisplayableWorkCardList(
  items: DmmItem[],
  options: PaginatedWorkListOptions = {},
): PaginatedWorkCardList {
  return getPaginatedWorkCardList(filterDisplayableItems(items), options);
}

export function getPaginatedWorksListPageCards(
  items: DmmItem[],
  options: PaginatedWorkListOptions = {},
): PaginatedWorkCardList {
  return paginateToWorkCards(items, options, WORKS_LIST_PAGE_SIZE);
}

export function getPaginatedWorkCardListFromSorted(
  sortedItems: DmmItem[],
  options: PaginatedWorkListOptions = {},
): PaginatedWorkCardList {
  const pageSize = options.pageSize ?? CATALOG_DETAIL_PAGE_SIZE;
  const pagination = paginateItems(
    sortedItems,
    parsePageParam(options.page),
    pageSize,
  );

  return {
    pageItems: toWorkListCardItems(pagination.items),
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    pageSize,
  };
}

export function mapPageItemsToWorkCards(
  items: DmmItem[],
  options: { includeSaleInfo?: boolean } = {},
): WorkListCardItem[] {
  return toWorkListCardItems(items, options);
}

export function mapSingleWorkCard(item: DmmItem): WorkListCardItem | null {
  return toWorkListCardItem(item);
}

export function parseListPageSort(value?: string | null): WorkSortKey {
  return parseWorkSortParam(value);
}
