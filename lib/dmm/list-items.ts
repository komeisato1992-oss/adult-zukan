import "server-only";

import { unstable_cache } from "next/cache";
import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import { filterValidListItems } from "@/lib/dmm/filter";
import { parseDmmPrice } from "@/lib/utils";
import { DMM_WORKS_REVALIDATE } from "@/lib/dmm/static-works";
import type { DmmItem } from "@/lib/dmm/types";

export const DMM_LIST_ITEMS_LIMIT = 1000;

const DMM_FETCH_BATCH_SIZE = 100;
/** 有効作品1000件集めるため、ランキングAPIを最大50ページまで取得 */
const DMM_MAX_FETCH_OFFSET = 5001;

export type DmmListItemsOptions = {
  limit?: number;
  keyword?: string;
  sort?: "date" | "rank" | "price" | "review";
  saleOnly?: boolean;
};

function isDmmItemOnSale(item: DmmItem): boolean {
  const price = parseDmmPrice(item.prices?.price);
  const listPrice = parseDmmPrice(item.prices?.list_price);
  return listPrice > 0 && price > 0 && price < listPrice;
}

async function fetchDmmListItemsUncached(
  options: DmmListItemsOptions = {},
): Promise<DmmItem[]> {
  if (!isDmmConfigured()) {
    return [];
  }

  const limit = options.limit ?? DMM_LIST_ITEMS_LIMIT;
  const collected: DmmItem[] = [];
  const seen = new Set<string>();

  for (
    let offset = 1;
    offset <= DMM_MAX_FETCH_OFFSET && collected.length < limit;
    offset += DMM_FETCH_BATCH_SIZE
  ) {
    let data;

    try {
      data = await fetchDmmItemList({
        hits: DMM_FETCH_BATCH_SIZE,
        sort: options.sort ?? "date",
        offset,
        keyword: options.keyword,
        revalidate: DMM_WORKS_REVALIDATE,
      });
    } catch {
      break;
    }

    let items = filterValidListItems(data.result.items);

    if (options.saleOnly) {
      items = items.filter(isDmmItemOnSale);
    }

    for (const item of items) {
      if (seen.has(item.content_id)) continue;
      seen.add(item.content_id);
      collected.push(item);

      if (collected.length >= limit) {
        break;
      }
    }

    if (
      data.result.items.length === 0 ||
      data.result.result_count < DMM_FETCH_BATCH_SIZE
    ) {
      break;
    }
  }

  return collected.slice(0, limit);
}

export async function getDmmListItems(
  options: DmmListItemsOptions = {},
): Promise<DmmItem[]> {
  const hasFilters = Boolean(options.keyword) || Boolean(options.saleOnly);

  if (hasFilters) {
    return fetchDmmListItemsUncached(options);
  }

  const cached = unstable_cache(
    () => fetchDmmListItemsUncached(options),
    [
      "dmm-list-items",
      String(options.limit ?? DMM_LIST_ITEMS_LIMIT),
      options.sort ?? "date",
    ],
    { revalidate: DMM_WORKS_REVALIDATE },
  );

  return cached();
}

export async function getDmmListItemsWithFallback(
  options: DmmListItemsOptions = {},
): Promise<DmmItem[]> {
  const items = await getDmmListItems(options);

  if (items.length > 0) {
    return items;
  }

  const { getDmmStaticWorks } = await import("@/lib/dmm/static-works");
  return getDmmStaticWorks();
}

export type DmmListItemsResult =
  | { success: true; items: DmmItem[] }
  | { success: false; message: string };

function isSaleFilter(params: { sale?: string; filter?: string }): boolean {
  return params.sale === "1" || params.filter === "sale";
}

function hasWorksListFilters(params: {
  q?: string;
  sale?: string;
  filter?: string;
  sort?: string;
}): boolean {
  return (
    Boolean(params.q?.trim()) ||
    isSaleFilter(params) ||
    Boolean(params.sort)
  );
}

export async function getWorksPageItems(params: {
  q?: string;
  sale?: string;
  filter?: string;
  sort?: string;
}): Promise<DmmListItemsResult> {
  const { getDmmStaticWorks } = await import("@/lib/dmm/static-works");
  const { filterCatalogWorks } = await import("@/lib/dmm/home-sections");

  const fallback = await getDmmStaticWorks();

  if (fallback.length > 0) {
    if (!hasWorksListFilters(params)) {
      return { success: true, items: fallback };
    }

    const items = filterCatalogWorks(fallback, {
      q: params.q,
      sale: isSaleFilter(params),
      sort:
        params.sort === "new"
          ? "new"
          : params.sort === "rank"
            ? "rank"
            : undefined,
    });

    return { success: true, items };
  }

  if (!isDmmConfigured()) {
    return {
      success: false,
      message: "作品を取得できませんでした",
    };
  }

  if (!hasWorksListFilters(params)) {
    const items = await getDmmListItemsWithFallback();
    if (items.length === 0) {
      return {
        success: false,
        message: "作品を取得できませんでした",
      };
    }
    return { success: true, items };
  }

  const items = await getDmmListItemsWithFallback({
    keyword: params.q?.trim() || undefined,
    sort: params.sort === "rank" ? "rank" : params.sort === "new" ? "date" : undefined,
    saleOnly: isSaleFilter(params),
  });

  if (items.length === 0) {
    return {
      success: false,
      message: "作品を取得できませんでした",
    };
  }

  return { success: true, items };
}

/** @deprecated getWorksPageItems を使用 */
export async function getDmmListItemsSafe(
  options: DmmListItemsOptions = {},
): Promise<DmmListItemsResult> {
  if (!isDmmConfigured()) {
    const { getDmmStaticWorks } = await import("@/lib/dmm/static-works");
    const fallback = await getDmmStaticWorks();
    if (fallback.length > 0) {
      return { success: true, items: fallback };
    }
    return {
      success: false,
      message: "作品を取得できませんでした",
    };
  }

  const items = await getDmmListItemsWithFallback(options);
  return { success: true, items };
}
