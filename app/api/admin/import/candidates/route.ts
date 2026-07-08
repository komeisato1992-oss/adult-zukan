import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getImportCandidates } from "@/lib/admin/import-candidates";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getImportCandidates();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "候補作品の取得に失敗しました。";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
