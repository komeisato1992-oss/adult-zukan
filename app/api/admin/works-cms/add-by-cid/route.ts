import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { fetchDmmItemByContentId } from "@/lib/dmm/client";
import { addSelectedWorksToCatalog } from "@/lib/admin/add-selected-works";
import { slimWorkItemForAdd } from "@/lib/admin/import-add-payload";
import type { DmmItem } from "@/lib/dmm/types";
import { invalidateWorksCmsOverviewCache } from "@/lib/admin/works-cms-service";

export const dynamic = "force-dynamic";

/** CID直接追加（複数可・カンマ/改行区切り） */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    invalidateWorksCmsOverviewCache();
    const body = (await request.json()) as { cids?: string | string[] };
    const raw = Array.isArray(body.cids)
      ? body.cids
      : String(body.cids ?? "").split(/[\s,]+/);
    const cids = [
      ...new Set(
        raw
          .map((c) => normalizeCatalogContentId(String(c)))
          .filter((c): c is string => Boolean(c)),
      ),
    ].slice(0, 200);

    if (cids.length === 0) {
      return NextResponse.json({ error: "CIDを入力してください" }, { status: 400 });
    }

    const items: DmmItem[] = [];
    const errors: Array<{ cid: string; message: string }> = [];
    for (const cid of cids) {
      try {
        const response = await fetchDmmItemByContentId(cid);
        const item = response.result?.items?.[0];
        if (!item) {
          errors.push({ cid, message: "FANZAから取得できませんでした" });
          continue;
        }
        items.push(item);
      } catch (error) {
        errors.push({
          cid,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "取得できた作品がありません",
          errors,
        },
        { status: 400 },
      );
    }

    const works = items.map((item) => ({
      contentId: normalizeCatalogContentId(item.content_id),
      item: slimWorkItemForAdd(item),
      sourcePopularityRank: item.sourcePopularityRank ?? null,
    }));
    const result = await addSelectedWorksToCatalog(works);

    return NextResponse.json({
      success: true,
      addedCount: result.summary.addedCount,
      duplicateCount: result.summary.catalogDuplicateCount,
      errors,
      message: result.message,
      deployRequired: false,
      gitWrite: false,
      committedToGitHub: result.committedToGitHub,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[works-cms/add-by-cid] failed", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
