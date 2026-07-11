import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getImportCollectProgress } from "@/lib/admin/import-collect-progress";
import { isImportCollectInProgress } from "@/lib/admin/import-collect";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const progress = getImportCollectProgress();

  return NextResponse.json({
    inProgress: isImportCollectInProgress(),
    progress,
  });
}
