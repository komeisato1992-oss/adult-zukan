"use client";

import useSWR, { mutate } from "swr";
import type { WorksCmsOverview } from "@/components/admin/works-cms/types";

export const WORKS_CMS_OVERVIEW_KEY = "/api/admin/works-cms/overview";

type OverviewResponse = {
  success: boolean;
  overview?: WorksCmsOverview;
  error?: string;
};

async function fetchOverview(url: string): Promise<WorksCmsOverview> {
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as OverviewResponse;
  if (!res.ok || !data.success || !data.overview) {
    throw new Error(data.error || "運用状況の取得に失敗しました");
  }
  return data.overview;
}

/**
 * 運用状況カード用。
 * - 初回のみ取得（タブ切替では再取得しない）
 * - 5分キャッシュ
 * - データ更新後は refreshWorksCmsOverview() で再取得
 */
export function useWorksCmsOverview() {
  return useSWR(WORKS_CMS_OVERVIEW_KEY, fetchOverview, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 5 * 60 * 1000,
    shouldRetryOnError: false,
  });
}

/** 更新ボタン / 作品追加・掲載更新・公開管理・見放題管理の後 */
export function refreshWorksCmsOverview(): Promise<WorksCmsOverview | undefined> {
  return mutate(
    WORKS_CMS_OVERVIEW_KEY,
    async () => {
      const res = await fetch(`${WORKS_CMS_OVERVIEW_KEY}?refresh=1`, {
        cache: "no-store",
      });
      const data = (await res.json()) as OverviewResponse;
      if (!res.ok || !data.success || !data.overview) {
        throw new Error(data.error || "運用状況の取得に失敗しました");
      }
      return data.overview;
    },
    { revalidate: false },
  );
}
