import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { handlePostImportSitemapUpdate } from "@/lib/admin/sitemap-admin-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 作品追加バッチ完了後に、サイトマップ更新と Google 再送信を 1 回だけ実行する */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await handlePostImportSitemapUpdate();
    return NextResponse.json({
      success: true,
      sitemap: {
        sitemapUpdated: result.sitemapUpdated,
        sitemapError: result.sitemapError,
        googleSubmission: {
          submitted: result.googleSubmission.submitted,
          skipped: result.googleSubmission.skipped,
          reason: result.googleSubmission.reason,
          dryRun: result.googleSubmission.dryRun,
        },
        refreshResults: result.refreshResults
          .filter(
            (entry) =>
              entry.key === "works" || entry.key.startsWith("works-"),
          )
          .map((entry) => ({
            key: entry.key,
            urlCount: entry.urlCount,
            addedCount: entry.addedCount,
          })),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "サイトマップ更新に失敗しました。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
