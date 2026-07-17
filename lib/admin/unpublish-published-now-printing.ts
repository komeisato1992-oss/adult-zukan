import "server-only";

import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  detectWorksCmsSchemaV2,
  upsertWorksCmsOverrides,
} from "@/lib/admin/works-cms-overrides";

export const NOW_PRINTING_BULK_UNPUBLISH_REASON = "now_printing_bulk_unpublish";

const PAGE = 500;

export type UnpublishPublishedNowPrintingFailure = {
  cid: string;
  reason: string;
};

export type UnpublishPublishedNowPrintingResult = {
  beforePublishedNowPrintingCount: number;
  targetCount: number;
  successCount: number;
  failureCount: number;
  failures: UnpublishPublishedNowPrintingFailure[];
  afterPublishedNowPrintingCount: number;
  after: {
    noImageCount: number;
    publishedNoImageCount: number;
    unpublishedCount: number;
    publishedCount: number;
  };
  changedColumns: string[];
  updateCondition: string;
  deployRequired: false;
  gitWrite: false;
};

async function countEq(
  client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  column: string,
  value: string | boolean,
): Promise<number> {
  const { count, error } = await client
    .from("works")
    .select("cid", { count: "exact", head: true })
    .eq(column, value);
  if (error) {
    throw new Error(`works集計失敗(${column}): ${error.message}`);
  }
  return count ?? 0;
}

async function countPublishedNowPrinting(
  client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
): Promise<number> {
  const { count, error } = await client
    .from("works")
    .select("cid", { count: "exact", head: true })
    .eq("image_status", "now_printing")
    .eq("published", true);
  if (error) {
    throw new Error(`公開中 now_printing 集計失敗: ${error.message}`);
  }
  return count ?? 0;
}

async function countNoImage(
  client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
): Promise<{ noImageCount: number; publishedNoImageCount: number }> {
  const noImageOr =
    "image_status.eq.now_printing,image_status.eq.fetch_failed,and(image_status.is.null,or(package_image.is.null,package_image.eq.))";
  const [noImageRes, publishedNoImageRes] = await Promise.all([
    client.from("works").select("cid", { count: "exact", head: true }).or(noImageOr),
    client
      .from("works")
      .select("cid", { count: "exact", head: true })
      .eq("published", true)
      .or(noImageOr),
  ]);
  if (noImageRes.error) {
    throw new Error(`画像なし集計失敗: ${noImageRes.error.message}`);
  }
  if (publishedNoImageRes.error) {
    throw new Error(
      `公開中画像なし集計失敗: ${publishedNoImageRes.error.message}`,
    );
  }
  return {
    noImageCount: noImageRes.count ?? 0,
    publishedNoImageCount: publishedNoImageRes.count ?? 0,
  };
}

async function listPublishedNowPrintingCids(
  client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
): Promise<string[]> {
  const cids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const { data, error } = await client
      .from("works")
      .select("cid")
      .eq("image_status", "now_printing")
      .eq("published", true)
      .order("cid", { ascending: true })
      .range(from, to);
    if (error) {
      throw new Error(`公開中 now_printing 取得失敗: ${error.message}`);
    }
    const batch = data ?? [];
    if (batch.length === 0) break;
    for (const raw of batch) {
      const cid = normalizeCatalogContentId(
        String((raw as { cid?: string }).cid ?? ""),
      );
      if (cid) cids.push(cid);
    }
    if (batch.length < PAGE) break;
  }
  // 同じ作品を重複更新しない
  return [...new Set(cids)];
}

/**
 * works テーブルから
 * image_status = 'now_printing' AND published = true
 * のみを直接取得し、一括非公開にする。
 *
 * package_image・画面一覧・検索結果は使わない。
 * fetch_failed / image_status null / 通常画像は対象外。
 * 作品削除はしない。Git / JSON / デプロイは発生しない。
 */
export async function unpublishPublishedNowPrintingWorks(): Promise<UnpublishPublishedNowPrintingResult> {
  const client = getSupabaseServiceClient();
  if (!client) {
    throw new Error("Supabase未設定のため実行できません");
  }

  const schemaV2 = await detectWorksCmsSchemaV2();
  const beforePublishedNowPrintingCount = await countPublishedNowPrinting(client);
  const targetCids = await listPublishedNowPrintingCids(client);
  const targetCount = targetCids.length;

  const failures: UnpublishPublishedNowPrintingFailure[] = [];
  let successCount = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < targetCids.length; i += PAGE) {
    const chunk = targetCids.slice(i, i + PAGE);
    const patch: Record<string, unknown> = {
      published: false,
      updated_at: now,
    };
    if (schemaV2) {
      patch.manual_hidden = true;
      patch.manual_hidden_reason = NOW_PRINTING_BULK_UNPUBLISH_REASON;
    }

    const { error: updateError } = await client
      .from("works")
      .update(patch)
      .in("cid", chunk)
      .eq("image_status", "now_printing")
      .eq("published", true);

    if (!updateError) {
      successCount += chunk.length;
      upsertWorksCmsOverrides(
        chunk.map((cid) => ({
          cid,
          manual_hidden: true,
          manual_hidden_reason: NOW_PRINTING_BULK_UNPUBLISH_REASON,
        })),
      );
      if (schemaV2) {
        try {
          await client
            .from("work_live_status")
            .update({ manual_hidden: true, updated_at: now })
            .in("cid", chunk);
        } catch {
          // live 行が無い作品は無視
        }
      }
      continue;
    }

    // バッチ失敗時は CID 単位で再試行し、失敗理由を残す
    for (const cid of chunk) {
      const { error: oneError } = await client
        .from("works")
        .update(patch)
        .eq("cid", cid)
        .eq("image_status", "now_printing")
        .eq("published", true);
      if (oneError) {
        failures.push({ cid, reason: oneError.message });
        continue;
      }
      successCount += 1;
      upsertWorksCmsOverrides([
        {
          cid,
          manual_hidden: true,
          manual_hidden_reason: NOW_PRINTING_BULK_UNPUBLISH_REASON,
        },
      ]);
      if (schemaV2) {
        try {
          await client
            .from("work_live_status")
            .update({ manual_hidden: true, updated_at: now })
            .eq("cid", cid);
        } catch {
          // ignore
        }
      }
    }
  }

  try {
    const { revalidateWorksMasterAfterAdd } = await import(
      "@/lib/dmm/works-master"
    );
    await revalidateWorksMasterAfterAdd();
  } catch (error) {
    console.warn("[unpublish-published-now-printing] revalidate skipped", error);
  }

  const [afterPublishedNowPrinting, noImage, publishedCount, unpublishedCount] =
    await Promise.all([
      countPublishedNowPrinting(client),
      countNoImage(client),
      countEq(client, "published", true),
      countEq(client, "published", false),
    ]);

  // 失敗なしで残存0なら、フィルタ付き更新で全件成功とみなす
  if (failures.length === 0) {
    successCount = Math.max(
      0,
      beforePublishedNowPrintingCount - afterPublishedNowPrinting,
    );
  }

  return {
    beforePublishedNowPrintingCount,
    targetCount,
    successCount,
    failureCount: failures.length,
    failures,
    afterPublishedNowPrintingCount: afterPublishedNowPrinting,
    after: {
      noImageCount: noImage.noImageCount,
      publishedNoImageCount: noImage.publishedNoImageCount,
      unpublishedCount,
      publishedCount,
    },
    changedColumns: schemaV2
      ? ["published", "manual_hidden", "manual_hidden_reason", "updated_at"]
      : ["published", "updated_at"],
    updateCondition: "image_status = 'now_printing' AND published = true",
    deployRequired: false,
    gitWrite: false,
  };
}

/** 確認ダイアログ用: 公開中 now_printing 件数のみ */
export async function countPublishedNowPrintingWorks(): Promise<number> {
  const client = getSupabaseServiceClient();
  if (!client) return 0;
  return countPublishedNowPrinting(client);
}
