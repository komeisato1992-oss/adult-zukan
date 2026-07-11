import { NextResponse } from "next/server";
import {
  addWorksToCatalog,
  toAddWorkErrorMessage,
} from "@/lib/admin/add-work";
import { resolveBulkAddSelection } from "@/lib/admin/resolve-bulk-selection";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { formatIndexUpdateStats } from "@/lib/dmm/index-builders";
import { logCatalogSnapshotThrownError } from "@/lib/dmm/catalog-snapshot-json";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as unknown;
    const { works } = await resolveBulkAddSelection(body);
    const result = await addWorksToCatalog(works);

    const addedCount = result.addedContentIds.length;
    const skippedCount =
      result.duplicateContentIds.length + result.invalidContentIds.length;

    const baseMessage =
      addedCount > 0
        ? [
            `${addedCount}件を追加しました。`,
            skippedCount > 0
              ? `${skippedCount}件は重複のためスキップしました。`
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
    });
  } catch (error) {
    logCatalogSnapshotThrownError(error);
    const { message, status } = toAddWorkErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
