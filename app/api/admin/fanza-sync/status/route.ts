import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getFanzaSyncStatus,
} from "@/lib/admin/fanza-sync-runner";
import { fanzaSyncProgressPercent } from "@/lib/admin/fanza-sync-job";
import { getAdultLightSyncTargetLimit } from "@/lib/admin/fanza-sync-constants";
import { getWorkLiveStatusStorageInfo } from "@/lib/dmm/work-live-status";
import { getWorksMasterStorageInfo } from "@/lib/dmm/works-master";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getFanzaSyncStatus();
  const job = snapshot.currentJob;
  const storage = await getWorkLiveStatusStorageInfo();
  const worksMaster = await getWorksMasterStorageInfo();
  const targetLimit = getAdultLightSyncTargetLimit();

  return NextResponse.json({
    success: true,
    currentJob: job,
    history: snapshot.history,
    progressPercent: job ? fanzaSyncProgressPercent(job) : 0,
    storage: {
      backend: storage.backend,
      label: storage.label,
      rowCount: storage.rowCount,
      deployRequired: false,
    },
    worksMaster: {
      backend: worksMaster.backend,
      label: worksMaster.label,
      rowCount: worksMaster.rowCount,
      deployRequired: false,
      supabaseConfigured: worksMaster.supabaseConfigured,
      metrics: worksMaster.metrics,
    },
    metrics: storage.metrics,
    syncTargetLimit: targetLimit > 0 ? targetLimit : null,
    note: "価格・セール・評価・販売状況をDBへ直接更新します。デプロイは発生しません。",
  });
}
