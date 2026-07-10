import { NextResponse } from "next/server";
import {
  addWorksToCatalog,
  toAddWorkErrorMessage,
} from "@/lib/admin/add-work";
import { parseBulkAddRequestBody } from "@/lib/admin/bulk-add-request";
import { isAdminAuthenticated } from "@/lib/admin/auth";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as unknown;
    const { works } = parseBulkAddRequestBody(body, "works");
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
          ? `${result.addedContentIds.length}件を追加しました`
          : "追加できる作品がありませんでした。",
    });
  } catch (error) {
    const { message, status } = toAddWorkErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
