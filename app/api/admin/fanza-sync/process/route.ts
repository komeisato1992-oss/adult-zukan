import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  FanzaSyncError,
  processFanzaSyncBatch,
} from "@/lib/admin/fanza-sync-runner";
import { fanzaSyncProgressPercent } from "@/lib/admin/fanza-sync-job";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      dryRun?: boolean;
    };

    const result = await processFanzaSyncBatch({
      dryRun: body.dryRun === true,
    });

    return NextResponse.json({
      success: true,
      ...result,
      progressPercent: result.job ? fanzaSyncProgressPercent(result.job) : 0,
    });
  } catch (error) {
    console.error("[fanza-sync/process] failed", error);

    if (error instanceof FanzaSyncError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { success: false, message: "同期バッチの処理に失敗しました。" },
      { status: 500 },
    );
  }
}
