import { NextResponse } from "next/server";
import {
  addWorkToCatalog,
  AddWorkValidationError,
  toAddWorkErrorMessage,
} from "@/lib/admin/add-work";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import type { DmmItem } from "@/lib/dmm/types";

type AddWorkRequestBody = {
  contentId?: string;
  item?: DmmItem;
};

function parseRequestBody(body: unknown): { contentId: string; item: DmmItem } {
  if (!body || typeof body !== "object") {
    throw new AddWorkValidationError("リクエスト形式が不正です。");
  }

  const payload = body as AddWorkRequestBody;
  const contentId = payload.contentId?.trim();
  const item = payload.item;

  if (!contentId || !item || typeof item !== "object") {
    throw new AddWorkValidationError("content_id と作品データが必要です。");
  }

  return { contentId, item };
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as unknown;
    const { contentId, item } = parseRequestBody(body);
    const result = await addWorkToCatalog(contentId, item);

    if (result.status === "duplicate") {
      return NextResponse.json(
        { error: "この作品はすでに追加済みです。" },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      contentId: result.contentId,
      message: "追加しました。Vercelの反映まで数分かかります。",
    });
  } catch (error) {
    const { message, status } = toAddWorkErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
