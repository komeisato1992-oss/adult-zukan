import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { resolveLightSyncEnabled, getAdminOpsSettingsView } from "@/lib/admin/admin-ops-settings";
import {
  getFanzaSyncStatus,
} from "@/lib/admin/fanza-sync-runner";
import { fanzaSyncProgressPercent } from "@/lib/admin/fanza-sync-job";
import { getAdultLightSyncTargetLimit } from "@/lib/admin/fanza-sync-constants";
import { getLiveStatusInitStatus } from "@/lib/admin/live-status-init-runner";
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
  const ops = getAdminOpsSettingsView();
  const lightSyncEnabled = resolveLightSyncEnabled();
  const liveInit = await getLiveStatusInitStatus();
  const liveInitJobPublic = liveInit.currentJob
    ? (() => {
        const { pendingCids: _p, ...rest } = liveInit.currentJob;
        void _p;
        return rest;
      })()
    : null;

  const worksCount = liveInit.worksCount || worksMaster.rowCount;
  const liveCount = liveInit.liveStatusCount || storage.rowCount;
  const missingCount = liveInit.missingCount;

  const syncTargetCount =
    targetLimit > 0
      ? targetLimit
      : liveCount != null && liveCount > 0
        ? liveCount
        : worksCount != null && worksCount > 0
          ? worksCount
          : 0;

  const canStartLightSync =
    lightSyncEnabled &&
    storage.runtime.enabled &&
    storage.runtime.tableAvailable !== false &&
    storage.countStatus !== "table_missing" &&
    storage.countStatus !== "connection_error" &&
    syncTargetCount > 0 &&
    !(job && (job.status === "running" || job.status === "pending"));

  const disableReasons: string[] = [];
  if (!lightSyncEnabled) {
    if (ops.lightSyncStatus === "unset") {
      disableReasons.push("環境変数が未設定");
    } else {
      disableReasons.push("軽量同期が無効です");
    }
  }
  if (!storage.runtime.hasSupabaseUrl || !storage.runtime.hasServiceRoleKey) {
    if (storage.backend === "supabase" || storage.backend === "off") {
      disableReasons.push("Supabase接続情報が不足しています");
    }
  }
  if (storage.countStatus === "table_missing") {
    disableReasons.push("work_live_statusテーブルがありません");
  } else if (storage.countStatus === "connection_error") {
    disableReasons.push("Supabase接続エラーです");
  } else if (storage.runtime.tableAvailable === false) {
    disableReasons.push("work_live_statusテーブルがありません");
  }
  if (syncTargetCount <= 0) {
    disableReasons.push("同期対象が0件です");
  }
  if (job && (job.status === "running" || job.status === "pending")) {
    disableReasons.push("現在別の同期が実行中です");
  }

  return NextResponse.json({
    success: true,
    currentJob: job,
    history: snapshot.history,
    progressPercent: job ? fanzaSyncProgressPercent(job) : 0,
    storage: {
      backend: storage.backend,
      label: storage.label,
      rowCount: storage.rowCount,
      countStatus: storage.countStatus,
      countMessage: storage.countMessage,
      deployRequired: false,
      runtime: storage.runtime,
    },
    worksMaster: {
      backend: worksMaster.backend,
      label: worksMaster.label,
      rowCount: worksMaster.rowCount,
      countStatus: worksMaster.countStatus,
      countMessage: worksMaster.countMessage,
      deployRequired: false,
      supabaseConfigured: worksMaster.supabaseConfigured,
      metrics: worksMaster.metrics,
    },
    counts: {
      worksMaster: worksCount,
      worksMasterStatus: worksMaster.countStatus,
      worksMasterMessage: worksMaster.countMessage,
      liveStatus: liveCount,
      liveStatusStatus: storage.countStatus,
      liveStatusMessage: storage.countMessage,
      missing: missingCount,
      initRatePercent: liveInit.initRatePercent,
    },
    liveStatusInit: {
      currentJob: liveInitJobPublic,
      progressPercent: liveInit.progressPercent,
      worksCount: liveInit.worksCount,
      liveStatusCount: liveInit.liveStatusCount,
      missingCount: liveInit.missingCount,
      initRatePercent: liveInit.initRatePercent,
    },
    lightSync: {
      enabled: lightSyncEnabled,
      status: ops.lightSyncStatus,
      source: ops.lightSyncSource,
      runtime: storage.runtime,
    },
    canStartLightSync,
    disableReasons: [...new Set(disableReasons)],
    syncTargetCount,
    metrics: storage.metrics,
    syncTargetLimit: targetLimit > 0 ? targetLimit : null,
    note: "価格・セール・評価・販売状況をDBへ直接更新します。デプロイは発生しません。",
  });
}
