import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  fanzaTvCheckProgressPercent,
  getFanzaTvCheckStatus,
} from "@/lib/admin/fanza-tv-check-runner";
import type { FanzaTvCheckJob } from "@/lib/admin/fanza-tv-check-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function publicJob(job: FanzaTvCheckJob | null) {
  if (!job) return null;
  const { pendingCids: _pending, ...rest } = job;
  void _pending;
  return {
    ...rest,
    pendingCount: job.pendingCids?.length ?? 0,
    progressPercent: fanzaTvCheckProgressPercent(job),
  };
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const status = await getFanzaTvCheckStatus();
  return NextResponse.json({
    ok: true,
    success: true,
    ...status,
    currentJob: publicJob(status.currentJob),
    deployRequired: false,
  });
}
