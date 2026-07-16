import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  FanzaTvCheckError,
  fanzaTvCheckProgressPercent,
  stopFanzaTvCheckJob,
} from "@/lib/admin/fanza-tv-check-runner";
import type { FanzaTvCheckJob } from "@/lib/admin/fanza-tv-check-types";

export const dynamic = "force-dynamic";

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
    const job = await stopFanzaTvCheckJob();
    return NextResponse.json({
      ok: true,
      success: true,
      currentJob: publicJob(job),
      message: job.message,
      deployRequired: false,
    });
  } catch (error) {
    console.error("[fanza-tv-check/stop] failed", error);
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
            : "FANZA TV判定の停止に失敗しました",
      },
      { status: 500 },
    );
  }
}
