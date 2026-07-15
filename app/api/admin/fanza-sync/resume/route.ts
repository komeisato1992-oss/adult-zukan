import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  FanzaSyncError,
  resumeFanzaSyncJob,
} from "@/lib/admin/fanza-sync-runner";
import { fanzaSyncProgressPercent } from "@/lib/admin/fanza-sync-job";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { job, alreadyRunning, resumed } = await resumeFanzaSyncJob();

    if (alreadyRunning) {
      return NextResponse.json({
        success: false,
        alreadyRunning: true,
        message: "現在、更新処理を実行中です",
        currentJob: job,
        progressPercent: fanzaSyncProgressPercent(job),
      });
    }

    return NextResponse.json({
      success: true,
      resumed,
      currentJob: job,
      progressPercent: fanzaSyncProgressPercent(job),
      message: "途中から同期を再開しました（DB更新のみ・デプロイなし）。",
    });
  } catch (error) {
    console.error("[fanza-sync/resume] failed", error);

    if (error instanceof FanzaSyncError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { success: false, message: "同期の再開に失敗しました。" },
      { status: 500 },
    );
  }
}
