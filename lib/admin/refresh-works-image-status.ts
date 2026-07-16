import "server-only";

import { NO_PACKAGE_IMAGE_REASON } from "@/lib/admin/unpublish-no-image-works";
import {
  getWorksCmsOverride,
  upsertWorksCmsOverrides,
} from "@/lib/admin/works-cms-overrides";
import { computeWorksPublished } from "@/lib/admin/works-cms-publish";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import type { DmmItem } from "@/lib/dmm/types";
import type { WorkMasterRow } from "@/lib/dmm/works-master/types";
import {
  detectAdultImageStatus,
  isAdultImageStatusOk,
} from "@/lib/works/image-status";
import { pickPackageImageCandidate } from "@/lib/works/package-image";

/**
 * 掲載情報更新バッチ後に works.package_image / image_status を更新する。
 * URL に now_printing / noimage があれば GET せず判定。それ以外のみ最大1回 GET。
 * 通常閲覧・検索・公開管理では呼ばない。
 */
export async function refreshWorksImageStatusFromDmmItems(
  works: DmmItem[],
  options?: { concurrency?: number },
): Promise<{ updated: number; nowPrinting: number; fetchFailed: number }> {
  const concurrency = options?.concurrency ?? 4;
  const { supabaseFetchWorkMasterByCids, supabaseUpsertWorkMasterRows } =
    await import("@/lib/dmm/works-master/supabase-store");
  const { supabaseFetchLiveStatusByCids } = await import(
    "@/lib/dmm/work-live-status/supabase-store"
  );

  const cids = [
    ...new Set(
      works
        .map((w) => normalizeCatalogContentId(w.content_id))
        .filter((cid): cid is string => Boolean(cid)),
    ),
  ];
  if (cids.length === 0) {
    return { updated: 0, nowPrinting: 0, fetchFailed: 0 };
  }

  const existingMap = await supabaseFetchWorkMasterByCids(cids);
  const liveMap = await supabaseFetchLiveStatusByCids(cids);
  const byCid = new Map<string, DmmItem>();
  for (const work of works) {
    const cid = normalizeCatalogContentId(work.content_id);
    if (cid) byCid.set(cid, work);
  }

  let updated = 0;
  let nowPrinting = 0;
  let fetchFailed = 0;
  const toUpsert: WorkMasterRow[] = [];
  const reasonPatches: Array<{
    cid: string;
    manual_hidden: boolean;
    manual_hidden_reason: string;
  }> = [];

  let nextIndex = 0;
  async function worker() {
    while (nextIndex < cids.length) {
      const i = nextIndex;
      nextIndex += 1;
      const cid = cids[i];
      const existing = existingMap.get(cid);
      const apiItem = byCid.get(cid);
      if (!existing || !apiItem) continue;

      const candidate =
        pickPackageImageCandidate(apiItem) ?? existing.package_image;
      const detected = await detectAdultImageStatus(candidate);
      if (detected.status === "now_printing") nowPrinting += 1;
      if (detected.status === "fetch_failed") fetchFailed += 1;

      const ov = getWorksCmsOverride(cid);
      const manualHidden = ov?.manual_hidden ?? existing.manual_hidden === true;
      const live = liveMap.get(cid);
      const published = computeWorksPublished({
        packageImage: candidate,
        imageStatus: detected.status,
        isAvailable: live?.is_available !== false,
        manualHidden,
        deletedAt: ov?.deleted_at ?? existing.deleted_at,
      });

      toUpsert.push({
        ...existing,
        package_image: candidate,
        image_status: detected.status,
        image_status_checked_at: detected.checkedAt,
        published,
        manual_hidden: manualHidden,
        updated_at: new Date().toISOString(),
      });
      updated += 1;

      if (!isAdultImageStatusOk(detected.status) && !manualHidden) {
        reasonPatches.push({
          cid,
          manual_hidden: false,
          manual_hidden_reason: NO_PACKAGE_IMAGE_REASON,
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, cids.length || 1) }, () =>
      worker(),
    ),
  );

  if (reasonPatches.length > 0) {
    upsertWorksCmsOverrides(reasonPatches);
  }
  if (toUpsert.length > 0) {
    await supabaseUpsertWorkMasterRows(toUpsert);
  }

  return { updated, nowPrinting, fetchFailed };
}
