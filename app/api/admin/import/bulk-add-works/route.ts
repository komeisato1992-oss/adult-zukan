import { NextResponse } from "next/server";
import {
  addWorksToCatalog,
  toAddWorkErrorMessage,
  AddWorkValidationError,
} from "@/lib/admin/add-work";
import { logBulkAddServerError } from "@/lib/admin/bulk-add-safe";
import { describeBulkAddRequestBody, resolveBulkAddSelection } from "@/lib/admin/resolve-bulk-selection";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { formatIndexUpdateStats } from "@/lib/dmm/index-builders";
import { logCatalogSnapshotThrownError } from "@/lib/dmm/catalog-snapshot-json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  console.log("[bulk-add] works route start");

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestBody: unknown = null;

  try {
    console.log("[bulk-add] works parsing request body");
    requestBody = await request.json();
    console.log("[bulk-add] works request body parsed");

    const resolved = await resolveBulkAddSelection(requestBody);
    console.log("[bulk-add] works selection resolved", resolved.debug);

    const result = await addWorksToCatalog(resolved.works);
    console.log("[bulk-add] works catalog add complete", {
      addedCount: result.addedContentIds.length,
      duplicateCount: result.duplicateContentIds.length,
      invalidCount: result.invalidContentIds.length,
      committedToGitHub: result.committedToGitHub,
    });

    const addedCount = result.addedContentIds.length;
    const skippedCount =
      result.duplicateContentIds.length + result.invalidContentIds.length;

    const baseMessage =
      addedCount > 0
        ? [
            `${addedCount}件を追加しました。`,
            skippedCount > 0
              ? `${skippedCount}件は重複または不正データのためスキップしました。`
              : null,
            "追加作品は一覧・検索・関連ページに反映されます。",
          ]
            .filter(Boolean)
            .join("\n")
        : skippedCount > 0
          ? `追加できる作品がありませんでした。${skippedCount}件は重複または不正データのためスキップしました。`
          : "追加できる作品がありませんでした。";

    const rebuiltNote = result.rebuiltCatalog
      ? " catalog-snapshot.json を読み込みましたが作品配列を特定できなかったため、works形式で復旧して追加しました。"
      : "";

    const indexNote =
      result.indexUpdateStats && result.committedToGitHub
        ? `\n\n${formatIndexUpdateStats(result.indexUpdateStats)}\n\nGitHubへ1回commitしました。\nVercelで自動デプロイが開始されました。`
        : result.committedToGitHub
          ? "\n\nGitHubへ1回commitしました。\nVercelで自動デプロイが開始されました。"
          : "";

    return NextResponse.json({
      success: true,
      addedCount,
      skippedCount,
      addedContentIds: result.addedContentIds,
      rebuiltCatalog: result.rebuiltCatalog,
      indexUpdateStats: result.indexUpdateStats,
      committedToGitHub: result.committedToGitHub,
      message: `${baseMessage}${rebuiltNote}${indexNote}`.trim(),
      debug: resolved.debug,
    });
  } catch (error) {
    logCatalogSnapshotThrownError(error);
    logBulkAddServerError("bulk-add-works route", error, {
      hasRequestBody: Boolean(requestBody),
    });
    const { message, status } = toAddWorkErrorMessage(error);
    const pipeline =
      error instanceof AddWorkValidationError ? error.pipeline : undefined;
    return NextResponse.json(
      {
        error: message,
        debug: describeBulkAddRequestBody(requestBody, pipeline),
      },
      { status },
    );
  }
}
