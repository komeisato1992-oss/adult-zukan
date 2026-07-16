import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  LiveStatusInitError,
  liveStatusInitProgressPercent,
  stopLiveStatusInitJob,
} from "@/lib/admin/live-status-init-runner";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const job = await stopLiveStatusInitJob();
    return NextResponse.json({
      ok: true,
      success: true,
      currentJob: job,
      progressPercent: liveStatusInitProgressPercent(job),
      message: job.message,
      deployRequired: false,
    });
  } catch (error) {
    console.error("[init-live-status/stop] failed", error);
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
        message: "初期化の停止に失敗しました",
      },
      { status: 500 },
    );
  }
}
