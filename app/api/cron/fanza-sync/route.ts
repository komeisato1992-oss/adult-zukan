import { NextResponse } from "next/server";
import { runFanzaSyncUntilDeadline } from "@/lib/admin/fanza-sync-runner";
import { fanzaSyncProgressPercent } from "@/lib/admin/fanza-sync-job";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_DEADLINE_MS = 280_000;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { job, alreadyRunning } = await runFanzaSyncUntilDeadline(
      CRON_DEADLINE_MS,
      "auto",
    );

    return NextResponse.json({
      success: true,
      alreadyRunning,
      message: alreadyRunning
        ? "既存ジョブ実行中"
        : job?.status === "running"
          ? "同期を継続中（次回 cron で再開）"
          : "同期バッチを実行しました",
      currentJob: job,
      progressPercent: job ? fanzaSyncProgressPercent(job) : 0,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "FANZA sync cron failed.";
    console.error("[fanza-sync/cron] failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
