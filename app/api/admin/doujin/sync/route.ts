import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { consumeAdminRateLimit } from "@/lib/admin/rate-limit";
import {
  getDoujinSyncOverview,
  processDoujinSyncRequestSlice,
  requestCancelDoujinSync,
  requestPauseDoujinSync,
  startDoujinSyncJob,
} from "@/lib/doujin/sync-service";
import {
  DOUJIN_SYNC_MODE_FULL,
  DOUJIN_SYNC_MODE_LIGHT,
  isDoujinSyncMode,
} from "@/lib/doujin/sync-mode";
import { getDoujinCatalogStats } from "@/lib/doujin/upsert";
import {
  DoujinLocalWriteDisabledError,
  doujinWriteDisabledJsonBody,
  isDoujinLocalWriteAllowed,
} from "@/lib/doujin/write-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

function forbiddenWrite() {
  return NextResponse.json(doujinWriteDisabledJsonBody(), { status: 403 });
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ...getDoujinSyncOverview(),
    stats: getDoujinCatalogStats(),
    notice: isDoujinLocalWriteAllowed()
      ? "大量取得は最大500件ずつ実行されます。処理中に同じジョブを重複実行しないでください。"
      : "本番環境では作品データの直接更新はできません。ローカル環境で同期を実行し、JSONをGitへコミット・pushしてください。",
  });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDoujinLocalWriteAllowed()) {
    return forbiddenWrite();
  }

  const rate = consumeAdminRateLimit("admin-doujin-sync", 60);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSec: rate.retryAfterSec },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as {
      action?: "start" | "pause" | "resume" | "cancel" | "tick";
      mode?: string;
      batchSize?: number;
      startOffset?: number;
      dryRun?: boolean;
      limit?: number;
      jobId?: string;
      site?: string;
      service?: string;
      floor?: string;
    };

    if (body.action === "pause") {
      const job = requestPauseDoujinSync(body.jobId);
      return NextResponse.json({ ok: true, job, ...getDoujinSyncOverview() });
    }

    if (body.action === "cancel") {
      const job = requestCancelDoujinSync(body.jobId);
      return NextResponse.json({ ok: true, job, ...getDoujinSyncOverview() });
    }

    if (body.action === "tick") {
      const overview = getDoujinSyncOverview();
      const jobId = body.jobId ?? overview.runningJobId;
      if (!jobId) {
        return NextResponse.json(
          { error: "No running sync job" },
          { status: 400 },
        );
      }
      const slice = await processDoujinSyncRequestSlice(jobId);
      return NextResponse.json({
        ok: true,
        job: slice.job,
        continueRunning: slice.continueRunning,
        persisted: slice.persisted,
        estimatedJsonSaves: slice.estimatedJsonSaves,
        rawShardCount: slice.rawShardCount,
        changedFields: slice.changedFields,
        ...getDoujinSyncOverview(),
        stats: getDoujinCatalogStats(),
      });
    }

    if (body.action === "start" || body.action === "resume") {
      if (!isDoujinSyncMode(body.mode)) {
        return NextResponse.json(
          {
            error: `mode must be "${DOUJIN_SYNC_MODE_LIGHT}" or "${DOUJIN_SYNC_MODE_FULL}"`,
          },
          { status: 400 },
        );
      }

      const job = startDoujinSyncJob({
        mode: body.mode,
        batchSize: body.batchSize,
        startOffset: body.startOffset,
        dryRun: body.dryRun,
        resume: body.action === "resume",
        limit: body.limit,
        site: body.site,
        service: body.service,
        floor: body.floor,
      });
      const slice = await processDoujinSyncRequestSlice(job.id);
      return NextResponse.json({
        ok: true,
        started: true,
        job: slice.job,
        continueRunning: slice.continueRunning,
        persisted: slice.persisted,
        estimatedJsonSaves: slice.estimatedJsonSaves,
        rawShardCount: slice.rawShardCount,
        changedFields: slice.changedFields,
        ...getDoujinSyncOverview(),
        stats: getDoujinCatalogStats(),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof DoujinLocalWriteDisabledError) {
      return forbiddenWrite();
    }
    const message = error instanceof Error ? error.message : "Sync failed";
    if (message.includes("実行中")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
