import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  FanzaTvCheckError,
  fanzaTvCheckProgressPercent,
  startFanzaTvCheckJob,
} from "@/lib/admin/fanza-tv-check-runner";
import type {
  FanzaTvCheckJob,
  FanzaTvCheckLimit,
  FanzaTvCheckMode,
} from "@/lib/admin/fanza-tv-check-types";

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

function parseMode(value: unknown): FanzaTvCheckMode | null {
  if (
    value === "unchecked_only" ||
    value === "full_recheck" ||
    value === "limit"
  ) {
    return value;
  }
  return null;
}

function parseLimit(value: unknown): FanzaTvCheckLimit | null {
  if (value === "all" || value === 100 || value === 500 || value === 1000) {
    return value;
  }
  if (value === "100") return 100;
  if (value === "500") return 500;
  if (value === "1000") return 1000;
  return null;
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: unknown;
      limit?: unknown;
    };
    const mode = parseMode(body.mode) ?? "unchecked_only";
    const limit = parseLimit(body.limit);

    const { job, alreadyRunning } = await startFanzaTvCheckJob({
      mode,
      limit,
    });

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
    console.error("[fanza-tv-check/start] failed", error);
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
            : "FANZA TV判定の開始に失敗しました",
      },
      { status: 500 },
    );
  }
}
