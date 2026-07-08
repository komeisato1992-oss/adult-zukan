import { NextResponse } from "next/server";
import {
  addWorksToCatalog,
  AddWorkValidationError,
  toAddWorkErrorMessage,
} from "@/lib/admin/add-work";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { IMPORT_BULK_ADD_MAX } from "@/lib/admin/import-constants";
import type { DmmItem } from "@/lib/dmm/types";

type BulkAddWorkEntry = {
  contentId?: string;
  item?: DmmItem;
};

type BulkAddRequestBody = {
  works?: BulkAddWorkEntry[];
};

function parseBulkRequestBody(body: unknown): Array<{ contentId: string; item: DmmItem }> {
  if (!body || typeof body !== "object") {
    throw new AddWorkValidationError("リクエスト形式が不正です。");
  }

  const payload = body as BulkAddRequestBody;
  if (!Array.isArray(payload.works) || payload.works.length === 0) {
    throw new AddWorkValidationError("追加する作品が選択されていません。");
  }

  if (payload.works.length > IMPORT_BULK_ADD_MAX) {
    throw new AddWorkValidationError("1回で追加できるのは100件までです");
  }

  return payload.works.map((entry, index) => {
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

    return NextResponse.json({
      success: true,
      addedCount: result.addedContentIds.length,
      addedContentIds: result.addedContentIds,
      duplicateCount: result.duplicateContentIds.length,
      duplicateContentIds: result.duplicateContentIds,
      invalidCount: result.invalidContentIds.length,
      message:
        result.addedContentIds.length > 0
          ? `${result.addedContentIds.length}件を追加しました。Vercelの反映まで数分かかります。`
          : "追加できる作品がありませんでした。",
    });
  } catch (error) {
    const { message, status } = toAddWorkErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
