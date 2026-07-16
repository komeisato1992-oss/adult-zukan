import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  LiveStatusInitError,
  liveStatusInitProgressPercent,
  processLiveStatusInitBatch,
} from "@/lib/admin/live-status-init-runner";
import type { LiveStatusInitJob } from "@/lib/admin/live-status-init-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function publicJob(job: LiveStatusInitJob) {
  const { pendingCids: _pending, ...rest } = job;
  void _pending;
  return { ...rest, pendingCount: job.pendingCids?.length ?? job.remainingCount };
}

/** 100件バッチを1回処理。クライアントが完了まで連続呼び出しする */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await processLiveStatusInitBatch();
    const job = publicJob(result.job);
    return NextResponse.json({
      ok: true,
      success: true,
      job,
      currentJob: job,
      done: result.done,
      waited: result.waited,
      progressPercent: liveStatusInitProgressPercent(result.job),
      message: result.job.message,
      deployRequired: false,
    });
  } catch (error) {
    console.error("[init-live-status/process] failed", error);
    const { loadLiveStatusInitSnapshot } = await import(
      "@/lib/admin/live-status-init-store"
    );
    const failedJob = loadLiveStatusInitSnapshot().currentJob;
    if (error instanceof LiveStatusInitError) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          message: error.message,
          job: failedJob ? publicJob(failedJob) : null,
          currentJob: failedJob ? publicJob(failedJob) : null,
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "変動情報の初期化バッチに失敗しました",
        job: failedJob ? publicJob(failedJob) : null,
        currentJob: failedJob ? publicJob(failedJob) : null,
      },
      { status: 500 },
    );
  }
}
