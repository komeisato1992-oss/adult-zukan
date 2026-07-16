import "server-only";

import { filterDisplayableItems } from "@/lib/dmm/filter";
import { isWorkOnSale, isWorksListSaleQuery } from "@/lib/dmm/sale-price";
import type { DmmItem } from "@/lib/dmm/types";
import { paginateItems, parsePageParam, WORKS_LIST_PAGE_SIZE } from "@/lib/pagination";
import { measureAsync, resetPerfCounters, getPerfSnapshot } from "@/lib/perf/measure";
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
  getTokyoDateString,
  getWorksSortOptions,
  isReleasedOnOrBefore,
  parseWorkSortParam,
  SALE_DEFAULT_WORK_SORT,
  sortWorks,
  type WorkSortOption,
} from "@/lib/works/sort";
import { tryGetWorksListPageDataFromDb } from "@/lib/works/public-list-query";

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
  seed?: string;
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
    seed: params.seed,
    genre: params.genre,
    genres: params.genres,
    maker: params.maker,
    makers: params.makers,
    price: params.price ?? "all",
    date: params.date ?? "all",
    page: params.page ?? "1",
  };
}

async function getWorksListPageDataFromCatalog(
  catalog: DmmItem[],
  query: WorksListQueryState,
): Promise<WorksListPageData> {
  const isSalePage = isWorksListSaleQuery(query);
  const today = getTokyoDateString();
  const displayableItems = filterDisplayableItems(catalog).filter((item) =>
    isReleasedOnOrBefore(item.date, today),
  );
  const filterEntries = buildWorkFilterEntries(displayableItems);
  const entriesForOptions = isSalePage
    ? filterEntries.filter((entry) => isWorkOnSale(entry.item))
    : filterEntries;
  const { genreOptions, makerOptions } =
    getWorkFilterOptionsFromEntries(entriesForOptions);
  const filtered = filterWorkEntriesByQuery(filterEntries, query);
  const currentSort = resolveWorksListSort(query, isSalePage);
  const catalogOrder = buildCatalogOrderMap(catalog);
  const sorted = sortWorks(filtered, currentSort, {
    catalogOrder,
    randomSeed: query.seed,
  });
  const currentPage = parsePageParam(query.page);
  const pagination = paginateItems(sorted, currentPage, WORKS_LIST_PAGE_SIZE);

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

export async function getWorksListPageData(
  catalog: DmmItem[] | null,
  query: WorksListQueryState,
): Promise<WorksListPageData> {
  return measureAsync("works.list_page", async () => {
    if (process.env.PERFORMANCE_DEBUG === "true") {
      resetPerfCounters();
    }

    const fromDb = await tryGetWorksListPageDataFromDb(query);
    if (fromDb) {
      if (process.env.PERFORMANCE_DEBUG === "true") {
        console.info("[perf] works.list_page.source=db", getPerfSnapshot());
      }
      return fromDb;
    }

    const items: DmmItem[] =
      catalog ??
      (await import("@/lib/catalog").then((m) => m.getCatalogWorks()));
    const result = await getWorksListPageDataFromCatalog(items, query);
    if (process.env.PERFORMANCE_DEBUG === "true") {
      console.info("[perf] works.list_page.source=catalog", {
        catalogSize: items.length,
        pageItems: result.pageItems.length,
        ...getPerfSnapshot(),
      });
    }
    return result;
  });
}
