import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  markImportCandidateExcluded,
  toImportCandidatesStoreErrorMessage,
} from "@/lib/admin/import-candidates-store";

type ExcludeWorkRequestBody = {
  contentId?: string;
};

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ExcludeWorkRequestBody;
    const contentId = body.contentId?.trim();

    if (!contentId) {
      return NextResponse.json(
        { error: "content_id が必要です。" },
        { status: 400 },
      );
    }

    await markImportCandidateExcluded(contentId);

    return NextResponse.json({
      success: true,
      contentId,
      message: "候補から除外しました。",
    });
  } catch (error) {
    const { message, status } = toImportCandidatesStoreErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
