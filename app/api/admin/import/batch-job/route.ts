import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { loadImportBatchJob } from "@/lib/admin/import-batch-job-store";
import { isBatchJobInProgress } from "@/lib/admin/import-batch-job-store";
import { getPublishedWorkCount } from "@/lib/admin/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ job }, currentCatalogCount] = await Promise.all([
    loadImportBatchJob(),
    getPublishedWorkCount(),
  ]);

  return NextResponse.json({
    inProgress: isBatchJobInProgress(),
    job,
    currentCatalogCount,
    remainingToTarget: Math.max(0, job.targetTotalCount - currentCatalogCount),
  });
}
