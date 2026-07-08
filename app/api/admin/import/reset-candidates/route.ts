import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  resetImportCandidates,
  toImportCandidatesStoreErrorMessage,
} from "@/lib/admin/import-candidates-store";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await resetImportCandidates();
    return NextResponse.json({
      success: true,
      message: "import-candidates.json を初期化しました。",
    });
  } catch (error) {
    const { message, status } = toImportCandidatesStoreErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
