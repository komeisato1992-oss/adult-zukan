import "server-only";

import { cache } from "react";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { getCatalogWorkById } from "@/lib/dmm/catalog-shards";
import { hydrateAdultWorkMedia } from "@/lib/dmm/catalog-media";
import type { DmmItem } from "@/lib/dmm/types";
import {
  fetchWorkMasterByCids,
  workMasterRowToDmmItem,
  type WorkMasterRow,
} from "@/lib/dmm/works-master";
import { applyLiveStatusToItem } from "@/lib/dmm/work-live-status";
import { localFetchLiveStatusByCids } from "@/lib/dmm/work-live-status/local-store";
import { supabaseFetchLiveStatusByCids } from "@/lib/dmm/work-live-status/supabase-store";
import {
  getConfiguredWorkLiveStatusBackend,
  type WorkLiveStatusRow,
} from "@/lib/dmm/work-live-status/types";
import { hasDisplayableAdultImage } from "@/lib/works/image-status";

export type PublicWorkDetailResult =
  | { status: "public"; item: DmmItem }
  | { status: "unavailable"; item: DmmItem }
  | { status: "not_found"; item: null };

/**
 * 一覧（public-list / RPC）と同じ公開条件。
 * - works.published = true
 * - image_status = ok または null（表示可能画像）
 * - work_live_status.is_available = true
 * - manual_hidden / deleted_at がない
 *
 * VR除外は行わない。
 */
export function isDbWorkPubliclyListable(
  row: WorkMasterRow,
  live: WorkLiveStatusRow | null | undefined,
): boolean {
  if (!row.published) return false;
  if (row.manual_hidden) return false;
  if (row.deleted_at) return false;
  if (
    !hasDisplayableAdultImage({
      imageStatus: row.image_status,
      packageImage: row.package_image,
    })
  ) {
    return false;
  }
  if (!live || live.is_available === false) return false;
  if (live.manual_hidden) return false;
  return true;
}

async function fetchLiveStatusRow(
  cid: string,
): Promise<WorkLiveStatusRow | null> {
  const backend = getConfiguredWorkLiveStatusBackend();
  if (backend === "off") return null;
  try {
    if (backend === "supabase") {
      const map = await supabaseFetchLiveStatusByCids([cid]);
      return map.get(cid) ?? null;
    }
    const map = await localFetchLiveStatusByCids([cid]);
    return map.get(cid) ?? null;
  } catch (error) {
    console.warn("[get-work] live status fetch failed", error);
    return null;
  }
}

/** カタログにだけある補助情報を存在判定なしで補完（サンプル動画など） */
function enrichFromCatalogSnapshot(item: DmmItem): DmmItem {
  try {
    const catalogItem = getCatalogWorkById(item.content_id);
    if (!catalogItem) return item;

    const hasSampleImages = Boolean(
      item.sampleImageURL?.sample_l?.image?.length ||
        item.sampleImageURL?.sample?.image?.length,
    );

    return {
      ...item,
      sampleMovieURL: item.sampleMovieURL ?? catalogItem.sampleMovieURL,
      sampleImageURL: hasSampleImages
        ? item.sampleImageURL
        : (catalogItem.sampleImageURL ?? item.sampleImageURL),
      comment: item.comment ?? catalogItem.comment,
      description: item.description?.trim()
        ? item.description
        : (catalogItem.description ?? catalogItem.comment ?? item.description),
    };
  } catch {
    return item;
  }
}

async function loadWorkDetailByCidUncached(
  contentId: string,
): Promise<PublicWorkDetailResult> {
  const cid = normalizeCatalogContentId(contentId);
  if (!cid) return { status: "not_found", item: null };

  const [masterMap, live] = await Promise.all([
    fetchWorkMasterByCids([cid]),
    fetchLiveStatusRow(cid),
  ]);

  const row = masterMap.get(cid);
  if (!row) return { status: "not_found", item: null };

  let item = workMasterRowToDmmItem(row);
  item = applyLiveStatusToItem(item, live);
  item = hydrateAdultWorkMedia(item);
  item = enrichFromCatalogSnapshot(item);

  if (isDbWorkPubliclyListable(row, live)) {
    return { status: "public", item };
  }

  return { status: "unavailable", item };
}

/**
 * 作品詳細の正式取得（cid = URL パラメータ）。
 * 存在判定は必ず Supabase works / work_live_status 基準。
 */
export const getPublicWorkDetailByCid = cache(
  async (contentId: string): Promise<PublicWorkDetailResult> => {
    return loadWorkDetailByCidUncached(contentId);
  },
);

/** 公開作品のみ取得（比較・旧 API 互換）。非公開は null */
export const getDmmWorkByContentId = cache(
  async (contentId: string): Promise<DmmItem | null> => {
    const result = await getPublicWorkDetailByCid(contentId);
    return result.status === "public" ? result.item : null;
  },
);
