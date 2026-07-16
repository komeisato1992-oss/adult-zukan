import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  LiveStatusInitError,
  liveStatusInitProgressPercent,
  resumeLiveStatusInitJob,
} from "@/lib/admin/live-status-init-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const { job, alreadyRunning } = await resumeLiveStatusInitJob();
    return NextResponse.json({
      ok: true,
      success: true,
      alreadyRunning,
      currentJob: job,
      progressPercent: liveStatusInitProgressPercent(job),
      message: job.message,
      deployRequired: false,
    });
  } catch (error) {
    console.error("[init-live-status/resume] failed", error);
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
        message: "初期化の再開に失敗しました",
      },
      { status: 500 },
    );
  }
}
