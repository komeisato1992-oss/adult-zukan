import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  FanzaSyncError,
  startFanzaSyncJob,
} from "@/lib/admin/fanza-sync-runner";
import { fanzaSyncProgressPercent } from "@/lib/admin/fanza-sync-job";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      batchSize?: number;
    };

    const { job, alreadyRunning } = await startFanzaSyncJob({
      trigger: "manual",
      batchSize:
        body.batchSize == null ? undefined : Number(body.batchSize),
    });

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
      alreadyRunning: false,
      currentJob: job,
      progressPercent: fanzaSyncProgressPercent(job),
    });
  } catch (error) {
    console.error("[fanza-sync/start] failed", error);

    if (error instanceof FanzaSyncError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { success: false, message: "同期ジョブの開始に失敗しました。" },
      { status: 500 },
    );
  }
}
