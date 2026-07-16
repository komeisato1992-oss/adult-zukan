import "server-only";

import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  detectWorksCmsSchemaV2,
  upsertWorksCmsOverrides,
} from "@/lib/admin/works-cms-overrides";
import {
  hasDisplayableAdultImage,
  isAdultImageStatusMissing,
} from "@/lib/works/image-status";

export const NO_PACKAGE_IMAGE_REASON = "no_package_image";

const PAGE = 500;

export type UnpublishNoImageResult = {
  scanned: number;
  noImageCount: number;
  unpublishedCount: number;
  alreadyUnpublishedCount: number;
  sampleCids: string[];
  deployRequired: false;
  gitWrite: false;
};

/**
 * works 内の画像なし作品を一括非公開にする。
 * image_status（追加・更新時判定）を優先し、未判定時のみ URL へフォールバック。
 */
export async function unpublishWorksWithoutPackageImage(): Promise<UnpublishNoImageResult> {
  const client = getSupabaseServiceClient();
  if (!client) {
    throw new Error("Supabase未設定のため実行できません");
  }

  const schemaV2 = await detectWorksCmsSchemaV2();
  let scanned = 0;
  let noImageCount = 0;
  let unpublishedCount = 0;
  let alreadyUnpublishedCount = 0;
  const sampleCids: string[] = [];
  const now = new Date().toISOString();

  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const { data, error } = await client
      .from("works")
      .select("cid,package_image,image_status,published")
      .order("cid", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`works取得失敗: ${error.message}`);
    }

    const batch = data ?? [];
    if (batch.length === 0) break;

    const toUnpublish: string[] = [];

    for (const raw of batch) {
      scanned += 1;
      const cid = normalizeCatalogContentId(
        String((raw as { cid?: string }).cid ?? ""),
      );
      if (!cid) continue;

      const packageImage =
        (raw as { package_image?: string | null }).package_image ?? null;
      const imageStatus =
        (raw as { image_status?: string | null }).image_status ?? null;
      const published = (raw as { published?: boolean }).published !== false;

      if (
        hasDisplayableAdultImage({
          imageStatus,
          packageImage,
        })
      ) {
        continue;
      }

      noImageCount += 1;
      if (sampleCids.length < 20) sampleCids.push(cid);

      if (!published) {
        alreadyUnpublishedCount += 1;
        upsertWorksCmsOverrides([
          {
            cid,
            manual_hidden: false,
            manual_hidden_reason: NO_PACKAGE_IMAGE_REASON,
          },
        ]);
        continue;
      }

      toUnpublish.push(cid);
    }

    if (toUnpublish.length > 0) {
      upsertWorksCmsOverrides(
        toUnpublish.map((cid) => ({
          cid,
          manual_hidden: false,
          manual_hidden_reason: NO_PACKAGE_IMAGE_REASON,
        })),
      );

      const patch: Record<string, unknown> = {
        published: false,
        updated_at: now,
      };
      if (schemaV2) {
        patch.manual_hidden = false;
        patch.manual_hidden_reason = NO_PACKAGE_IMAGE_REASON;
      }

      const { error: updateError } = await client
        .from("works")
        .update(patch)
        .in("cid", toUnpublish);

      if (updateError) {
        console.warn(
          "[unpublish-no-image] update failed",
          updateError.message,
        );
      } else {
        unpublishedCount += toUnpublish.length;
      }
    }

    if (batch.length < PAGE) break;
  }

  try {
    const { revalidateWorksMasterAfterAdd } = await import(
      "@/lib/dmm/works-master"
    );
    await revalidateWorksMasterAfterAdd();
  } catch (error) {
    console.warn("[unpublish-no-image] revalidate skipped", error);
  }

  return {
    scanned,
    noImageCount,
    unpublishedCount,
    alreadyUnpublishedCount,
    sampleCids,
    deployRequired: false,
    gitWrite: false,
  };
}

/** 概要用: 画像なし作品数を image_status 基準で数える */
export async function countWorksWithoutValidPackageImage(): Promise<{
  totalCount: number;
  noImageCount: number;
  publishedNoImageCount: number;
}> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { totalCount: 0, noImageCount: 0, publishedNoImageCount: 0 };
  }

  let totalCount = 0;
  let noImageCount = 0;
  let publishedNoImageCount = 0;

  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const { data, error } = await client
      .from("works")
      .select("cid,package_image,image_status,published")
      .order("cid", { ascending: true })
      .range(from, to);

    if (error) {
      console.warn("[count-no-image] failed", error.message);
      break;
    }

    const batch = data ?? [];
    if (batch.length === 0) break;

    for (const raw of batch) {
      totalCount += 1;
      const packageImage =
        (raw as { package_image?: string | null }).package_image ?? null;
      const imageStatus =
        (raw as { image_status?: string | null }).image_status ?? null;
      const published = (raw as { published?: boolean }).published !== false;
      const missing =
        isAdultImageStatusMissing(imageStatus) ||
        !hasDisplayableAdultImage({
          imageStatus,
          packageImage,
        });
      if (missing) {
        noImageCount += 1;
        if (published) publishedNoImageCount += 1;
      }
    }

    if (batch.length < PAGE) break;
  }

  return { totalCount, noImageCount, publishedNoImageCount };
}
