import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  FanzaTvCheckError,
  fanzaTvCheckProgressPercent,
  resumeFanzaTvCheckJob,
} from "@/lib/admin/fanza-tv-check-runner";
import type { FanzaTvCheckJob } from "@/lib/admin/fanza-tv-check-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function publicJob(job: FanzaTvCheckJob) {
  const { pendingCids: _pending, ...rest } = job;
  void _pending;
  return {
    ...rest,
    pendingCount: job.pendingCids?.length ?? 0,
    progressPercent: fanzaTvCheckProgressPercent(job),
  };
}

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const { job, alreadyRunning } = await resumeFanzaTvCheckJob();
    return NextResponse.json({
      ok: true,
      success: true,
      alreadyRunning,
      currentJob: publicJob(job),
      message: alreadyRunning
        ? "判定が既に実行中です"
        : job.message,
      deployRequired: false,
    });
  } catch (error) {
    console.error("[fanza-tv-check/resume] failed", error);
    if (error instanceof FanzaTvCheckError) {
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
            : "FANZA TV判定の再開に失敗しました",
      },
      { status: 500 },
    );
  }
}
