import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { processWorksMasterMigrationBatch } from "@/lib/admin/works-master-migration-runner";
import {
  estimateWorksMasterMigrationRemainingMs,
  worksMasterMigrationProgressPercent,
  worksMasterMigrationRemainingCount,
} from "@/lib/admin/works-master-migration-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processWorksMasterMigrationBatch();
    const job = result.job;
    return NextResponse.json({
      success: true,
      job,
      batch: result.batch,
      done: result.done,
      stopped: result.stopped,
      progressPercent: worksMasterMigrationProgressPercent(job),
      remainingCount: worksMasterMigrationRemainingCount(job),
      estimatedRemainingMs: estimateWorksMasterMigrationRemainingMs(job),
      deployRequired: false,
      gitWrite: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[works-master-migration/process] failed", error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
