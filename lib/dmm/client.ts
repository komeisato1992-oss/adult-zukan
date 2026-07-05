import "server-only";

import type { DmmFetchOptions, DmmItemListResponse } from "@/lib/dmm/types";

const DMM_API_BASE = "https://api.dmm.com/affiliate/v3/ItemList";

export function isDmmConfigured(): boolean {
  return Boolean(process.env.DMM_API_ID && process.env.DMM_AFFILIATE_ID);
}

export async function fetchDmmItemList(
  options: DmmFetchOptions = {},
): Promise<DmmItemListResponse> {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    throw new Error("DMM API credentials are not configured");
  }

  const url = new URL(DMM_API_BASE);
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("affiliate_id", affiliateId);
  url.searchParams.set("site", "FANZA");
  url.searchParams.set("service", "digital");
  url.searchParams.set("floor", "videoa");
  url.searchParams.set("output", "json");
  url.searchParams.set("hits", String(options.hits ?? 100));
  url.searchParams.set("offset", String(options.offset ?? 1));

  if (options.sort) {
    url.searchParams.set("sort", options.sort);
  }

  if (options.keyword) {
    url.searchParams.set("keyword", options.keyword);
  }

  const response = await fetch(url.toString(), {
    next: { revalidate: 3600 },
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
