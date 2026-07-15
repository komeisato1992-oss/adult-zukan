import "server-only";

import { filterDisplayableItems } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import { mergeLiveStatusIntoItems } from "@/lib/dmm/work-live-status";
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
  type SortWorksOptions,
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
  catalogOrder?: SortWorksOptions["catalogOrder"];
};

async function paginateToWorkCards(
  items: DmmItem[],
  options: PaginatedWorkListOptions,
  defaultPageSize: number,
): Promise<PaginatedWorkCardList> {
  const pageSize = options.pageSize ?? defaultPageSize;
  const sort = options.sort ?? DEFAULT_WORK_SORT;
  const sorted = sortWorks(items, sort, {
    catalogOrder: options.catalogOrder,
  });
  const pagination = paginateItems(sorted, parsePageParam(options.page), pageSize);
  const pageWithLive = await mergeLiveStatusIntoItems(pagination.items);

  return {
    pageItems: toWorkListCardItems(pageWithLive),
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    pageSize,
  };
}

export async function getPaginatedWorkCardList(
  items: DmmItem[],
  options: PaginatedWorkListOptions = {},
): Promise<PaginatedWorkCardList> {
  return paginateToWorkCards(items, options, CATALOG_DETAIL_PAGE_SIZE);
}

export async function getPaginatedDisplayableWorkCardList(
  items: DmmItem[],
  options: PaginatedWorkListOptions = {},
): Promise<PaginatedWorkCardList> {
  const safeItems = Array.isArray(items) ? items : [];
  return getPaginatedWorkCardList(filterDisplayableItems(safeItems), options);
}

export async function getPaginatedWorksListPageCards(
  items: DmmItem[],
  options: PaginatedWorkListOptions = {},
): Promise<PaginatedWorkCardList> {
  return paginateToWorkCards(items, options, WORKS_LIST_PAGE_SIZE);
}

export async function getPaginatedWorkCardListFromSorted(
  sortedItems: DmmItem[],
  options: PaginatedWorkListOptions = {},
): Promise<PaginatedWorkCardList> {
  const pageSize = options.pageSize ?? CATALOG_DETAIL_PAGE_SIZE;
  const pagination = paginateItems(
    sortedItems,
    parsePageParam(options.page),
    pageSize,
  );
  const pageWithLive = await mergeLiveStatusIntoItems(pagination.items);

  return {
    pageItems: toWorkListCardItems(pageWithLive),
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
