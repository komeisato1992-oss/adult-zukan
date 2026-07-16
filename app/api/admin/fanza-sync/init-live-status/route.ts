import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getLiveStatusInitStatus,
  LiveStatusInitError,
  liveStatusInitProgressPercent,
  startLiveStatusInitJob,
} from "@/lib/admin/live-status-init-runner";
import type { LiveStatusInitJob } from "@/lib/admin/live-status-init-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function publicJob(job: LiveStatusInitJob | null) {
  if (!job) return null;
  const { pendingCids: _pending, ...rest } = job;
  void _pending;
  return { ...rest, pendingCount: job.pendingCids?.length ?? job.remainingCount };
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const status = await getLiveStatusInitStatus();
  return NextResponse.json({
    ok: true,
    success: true,
    ...status,
    currentJob: publicJob(status.currentJob),
    progressPercent: status.currentJob
      ? liveStatusInitProgressPercent(status.currentJob)
      : status.initRatePercent,
    deployRequired: false,
  });
}

/** 自動初期化ジョブ開始 */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const { job, alreadyRunning } = await startLiveStatusInitJob();
    const pub = publicJob(job);
    return NextResponse.json({
      ok: true,
      success: true,
      alreadyRunning,
      currentJob: pub,
      progressPercent: liveStatusInitProgressPercent(job),
      message: alreadyRunning
        ? "初期化が既に実行中です"
        : job.message,
      deployRequired: false,
    });
  } catch (error) {
    console.error("[init-live-status/start] failed", error);
    if (error instanceof LiveStatusInitError) {
      return NextResponse.json(
        { ok: false, success: false, message: error.message },
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
            : "変動情報の初期化開始に失敗しました",
      },
      { status: 500 },
    );
  }
}
