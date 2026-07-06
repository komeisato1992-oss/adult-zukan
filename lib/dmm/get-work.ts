import "server-only";

import { unstable_cache } from "next/cache";
import {
  fetchDmmItemByContentId,
  isDmmConfigured,
} from "@/lib/dmm/client";
import {
  DMM_WORKS_REVALIDATE,
  getDmmStaticWorks,
} from "@/lib/dmm/static-works";
import type { DmmItem } from "@/lib/dmm/types";

async function fetchDmmWorkUncached(
  contentId: string,
): Promise<DmmItem | null> {
  if (!isDmmConfigured()) {
    return null;
  }

  try {
    const staticWorks = await getDmmStaticWorks();
    const fromList = staticWorks.find((item) => item.content_id === contentId);
    if (fromList) {
      return fromList;
    }
  } catch {
    // 一覧キャッシュ取得失敗時は個別取得へフォールバック
  }

  try {
    const data = await fetchDmmItemByContentId(contentId);
    return data.result.items[0] ?? null;
  } catch {
    return null;
  }
}

export async function getDmmWorkByContentId(
  contentId: string,
): Promise<DmmItem | null> {
  if (!isDmmConfigured()) {
    return null;
  }

  const cached = unstable_cache(
    () => fetchDmmWorkUncached(contentId),
    ["dmm-work", contentId],
    { revalidate: DMM_WORKS_REVALIDATE },
  );

  return cached();
}
