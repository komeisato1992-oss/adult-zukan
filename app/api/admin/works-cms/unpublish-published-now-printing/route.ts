import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  countPublishedNowPrintingWorks,
  unpublishPublishedNowPrintingWorks,
} from "@/lib/admin/unpublish-published-now-printing";
import { invalidateWorksCmsOverviewCache } from "@/lib/admin/works-cms-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 確認用: 公開中 now_printing 件数 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const count = await countPublishedNowPrintingWorks();
    return NextResponse.json({
      success: true,
      count,
      condition: "image_status = now_printing AND published = true",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[works-cms/unpublish-published-now-printing] count failed", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * 公開中の NOW PRINTING 作品だけを一括非公開。
 * Git / JSON / catalog-staging / commit / push / Vercel デプロイは行わない。
 */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await unpublishPublishedNowPrintingWorks();
    invalidateWorksCmsOverviewCache();
    return NextResponse.json({
      success: true,
      ...result,
      message: [
        "画像なし作品の一括非公開が完了しました。",
        `対象：${result.targetCount}件`,
        `成功：${result.successCount}件`,
        `失敗：${result.failureCount}件`,
        `公開中の画像なし：${result.after.publishedNoImageCount}件`,
        `（うち now_printing 公開中：${result.afterPublishedNowPrintingCount}件）`,
      ].join("\n"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[works-cms/unpublish-published-now-printing] failed", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
