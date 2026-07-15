import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  estimateWorksMasterMigrationRemainingMs,
  worksMasterMigrationProgressPercent,
  worksMasterMigrationRemainingCount,
  worksMasterMigrationStatusLabel,
} from "@/lib/admin/works-master-migration-job";
import {
  getWorksMasterMigrationStatus,
  previewWorksMasterMigration,
} from "@/lib/admin/works-master-migration-runner";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [status, preview] = await Promise.all([
    getWorksMasterMigrationStatus(),
    previewWorksMasterMigration(),
  ]);

  const job = status.job;
  return NextResponse.json({
    success: true,
    preview,
    job,
    statusLabel: job
      ? worksMasterMigrationStatusLabel(job.status)
      : "未開始",
    progressPercent: job ? worksMasterMigrationProgressPercent(job) : 0,
    remainingCount: job ? worksMasterMigrationRemainingCount(job) : preview.jsonUniqueCidCount,
    estimatedRemainingMs: job
      ? estimateWorksMasterMigrationRemainingMs(job)
      : null,
    jsonKeptAsFallback: true,
    deployRequired: false,
    gitWrite: false,
    note: "既存JSONはフォールバックとして維持します。Git差分・デプロイ・ISR一括再生成は行いません。",
  });
}
