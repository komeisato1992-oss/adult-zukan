import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getFanzaSyncStatus,
} from "@/lib/admin/fanza-sync-runner";
import { fanzaSyncProgressPercent } from "@/lib/admin/fanza-sync-job";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getFanzaSyncStatus();
  const job = snapshot.currentJob;

  return NextResponse.json({
    success: true,
    currentJob: job,
    history: snapshot.history,
    progressPercent: job ? fanzaSyncProgressPercent(job) : 0,
  });
}
