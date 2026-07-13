import "server-only";

import { DMM_API_AFFILIATE_ID_FALLBACK } from "@/lib/dmm/constants";
import type { DmmFetchOptions, DmmItemListResponse } from "@/lib/dmm/types";

const DMM_API_BASE = "https://api.dmm.com/affiliate/v3/ItemList";

function getDmmAffiliateId(): string | undefined {
  return process.env.DMM_AFFILIATE_ID ?? DMM_API_AFFILIATE_ID_FALLBACK;
}

export function isDmmConfigured(): boolean {
  return Boolean(process.env.DMM_API_ID && getDmmAffiliateId());
}

export async function fetchDmmItemList(
  options: DmmFetchOptions = {},
): Promise<DmmItemListResponse> {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = getDmmAffiliateId();

  if (!apiId || !affiliateId) {
    throw new Error("DMM API credentials are not configured");
  }

  const url = new URL(DMM_API_BASE);
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("affiliate_id", affiliateId);
  url.searchParams.set("site", options.site ?? "FANZA");
  url.searchParams.set("service", options.service ?? "digital");
  url.searchParams.set("floor", options.floor ?? "videoa");
  url.searchParams.set("output", "json");
  url.searchParams.set("hits", String(options.hits ?? 100));
  url.searchParams.set("offset", String(options.offset ?? 1));

  if (options.sort) {
    // DMM API: sort=rank がFANZAランキング順（人気順）
    url.searchParams.set("sort", options.sort);
  }

  if (options.keyword) {
    url.searchParams.set("keyword", options.keyword);
  }

  if (options.cid) {
    url.searchParams.set("cid", options.cid);
  }

  const response = await fetch(url.toString(), {
    ...(options.cache
      ? { cache: options.cache }
      : { next: { revalidate: options.revalidate ?? 3600 } }),
  });

  if (!response.ok) {
    throw new Error(`DMM API request failed: ${response.status}`);
  }

  const data = (await response.json()) as DmmItemListResponse;

  if (String(data.result.status) !== "200") {
    throw new Error(`DMM API returned status ${data.result.status}`);
  }

  return data;
}

/** 一般動画作品をキーワード検索で取得（接続テスト用） */
export async function fetchItem(): Promise<DmmItemListResponse> {
  return fetchDmmItemList({
    keyword: "IPZZ",
    hits: 20,
    sort: "date",
    offset: 1,
    cache: "no-store",
  });
}

/** content_id で作品を1件取得 */
export async function fetchDmmItemByContentId(
  contentId: string,
): Promise<DmmItemListResponse> {
  return fetchDmmItemList({
    cid: contentId,
    hits: 1,
    revalidate: 86400,
  });
}
