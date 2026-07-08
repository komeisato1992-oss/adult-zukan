import { NextResponse } from "next/server";
import {
  AddWorkValidationError,
  previewBulkAddWorks,
  toAddWorkErrorMessage,
} from "@/lib/admin/add-work";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { IMPORT_BULK_ADD_MAX } from "@/lib/admin/import-constants";
import type { DmmItem } from "@/lib/dmm/types";

type PreviewWorkEntry = {
  contentId?: string;
  item?: DmmItem;
};

type BulkAddPreviewRequestBody = {
  selectedWorks?: PreviewWorkEntry[];
};

function parsePreviewRequestBody(
  body: unknown,
): Array<{ contentId: string; item: DmmItem }> {
  if (!body || typeof body !== "object") {
    throw new AddWorkValidationError("リクエスト形式が不正です。");
  }

  const payload = body as BulkAddPreviewRequestBody;
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
    const works = parsePreviewRequestBody(body);
    const preview = await previewBulkAddWorks(works);

    return NextResponse.json(preview);
  } catch (error) {
    const { message, status } = toAddWorkErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
