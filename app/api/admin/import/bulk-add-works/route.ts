import { NextResponse } from "next/server";
import {
  addWorksToCatalog,
  AddWorkValidationError,
  toAddWorkErrorMessage,
} from "@/lib/admin/add-work";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { IMPORT_BULK_ADD_MAX } from "@/lib/admin/import-constants";
import { formatIndexUpdateStats } from "@/lib/dmm/index-builders";
import { logCatalogSnapshotThrownError } from "@/lib/dmm/catalog-snapshot-json";
import type { DmmItem } from "@/lib/dmm/types";

type BulkAddWorkEntry = {
  contentId?: string;
  item?: DmmItem;
};

type BulkAddWorksRequestBody = {
  selectedWorks?: BulkAddWorkEntry[];
};

function parseBulkRequestBody(
  body: unknown,
): Array<{ contentId: string; item: DmmItem }> {
  if (!body || typeof body !== "object") {
    throw new AddWorkValidationError("リクエスト形式が不正です。");
  }

  const payload = body as BulkAddWorksRequestBody;
  if (!Array.isArray(payload.selectedWorks) || payload.selectedWorks.length === 0) {
    throw new AddWorkValidationError("追加する作品が選択されていません。");
  }

  if (payload.selectedWorks.length > IMPORT_BULK_ADD_MAX) {
    throw new AddWorkValidationError("1回で追加できるのは100件までです");
  }

  return payload.selectedWorks.map((entry, index) => {
    const contentId = entry.contentId?.trim();
    const item = entry.item;

    if (!contentId || !item || typeof item !== "object") {
      throw new AddWorkValidationError(`作品データ(${index + 1}件目)が不正です。`);
    }

    return { contentId, item };
  });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as unknown;
    const works = parseBulkRequestBody(body);
    const result = await addWorksToCatalog(works);

    const addedCount = result.addedContentIds.length;
    const skippedCount =
      result.duplicateContentIds.length + result.invalidContentIds.length;

    const baseMessage =
      addedCount > 0
        ? `${addedCount}件を追加しました。${skippedCount}件は重複のためスキップしました。`
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
