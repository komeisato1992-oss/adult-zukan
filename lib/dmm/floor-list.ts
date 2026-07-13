import "server-only";

import { DMM_API_AFFILIATE_ID_FALLBACK } from "@/lib/dmm/constants";
import { isDmmConfigured } from "@/lib/dmm/client";

const DMM_FLOOR_LIST_URL = "https://api.dmm.com/affiliate/v3/FloorList";

export type DmmFloorEntry = {
  siteName: string;
  siteCode: string;
  serviceName: string;
  serviceCode: string;
  floorName: string;
  floorCode: string;
};

type FloorListApiResponse = {
  result: {
    status: string | number;
    site?: Array<{
      name: string;
      code: string;
      service?: Array<{
        name: string;
        code: string;
        floor?: Array<{
          name: string;
          code: string;
          id?: string | number;
        }>;
      }>;
    }>;
  };
};

function getDmmAffiliateId(): string | undefined {
  return process.env.DMM_AFFILIATE_ID ?? DMM_API_AFFILIATE_ID_FALLBACK;
}

/** DMM FloorList API（サイト/サービス/フロア一覧） */
export async function fetchDmmFloorList(): Promise<DmmFloorEntry[]> {
  if (!isDmmConfigured()) {
    throw new Error("DMM API credentials are not configured");
  }

  const apiId = process.env.DMM_API_ID!;
  const affiliateId = getDmmAffiliateId()!;

  const url = new URL(DMM_FLOOR_LIST_URL);
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("affiliate_id", affiliateId);
  url.searchParams.set("output", "json");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`DMM FloorList request failed: ${response.status}`);
  }

  const data = (await response.json()) as FloorListApiResponse;
  if (String(data.result.status) !== "200") {
    throw new Error(`DMM FloorList returned status ${data.result.status}`);
  }

  const entries: DmmFloorEntry[] = [];
  for (const site of data.result.site ?? []) {
    for (const service of site.service ?? []) {
      for (const floor of service.floor ?? []) {
        entries.push({
          siteName: site.name,
          siteCode: site.code,
          serviceName: service.name,
          serviceCode: service.code,
          floorName: floor.name,
          floorCode: floor.code,
        });
      }
    }
  }

  return entries;
}

export function filterDoujinRelatedFloors(
  entries: DmmFloorEntry[],
): DmmFloorEntry[] {
  return entries.filter((entry) => {
    const blob = [
      entry.siteName,
      entry.siteCode,
      entry.serviceName,
      entry.serviceCode,
      entry.floorName,
      entry.floorCode,
    ]
      .join(" ")
      .toLowerCase();
    return (
      blob.includes("同人") ||
      blob.includes("doujin") ||
      entry.serviceCode === "doujin" ||
      entry.floorCode.includes("doujin")
    );
  });
}
