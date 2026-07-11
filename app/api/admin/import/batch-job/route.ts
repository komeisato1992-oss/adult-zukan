import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { readImportBatchJobForDisplay } from "@/lib/admin/import-batch-job-store";
import { getPublishedWorkCount } from "@/lib/admin/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [job, currentCatalogCount] = await Promise.all([
    readImportBatchJobForDisplay(),
    getPublishedWorkCount(),
  ]);

  return NextResponse.json({
    inProgress: job.status === "running" && job.activeJobId != null,
    job,
    currentCatalogCount,
    remainingToTarget: Math.max(0, job.targetTotalCount - currentCatalogCount),
  });
}
