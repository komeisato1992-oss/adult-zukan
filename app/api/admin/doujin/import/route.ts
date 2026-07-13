import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { consumeAdminRateLimit } from "@/lib/admin/rate-limit";
import {
  clearDoujinImportRunner,
  ensureDoujinImportRunner,
  getDoujinImportOverview,
  processDoujinImportRequestSlice,
  requestCancelDoujinImport,
  requestPauseDoujinImport,
  startDoujinImportJob,
} from "@/lib/doujin/import-service";
import { getDoujinCatalogStats } from "@/lib/doujin/upsert";
import type { DoujinImportJobType } from "@/lib/doujin/types";
import {
  DoujinLocalWriteDisabledError,
  doujinWriteDisabledJsonBody,
  isDoujinLocalWriteAllowed,
} from "@/lib/doujin/write-guard";

export const runtime = "nodejs";
/** 短いバッチのみ。長時間ループしない */
export const maxDuration = 60;

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ...getDoujinImportOverview(),
    stats: getDoujinCatalogStats(),
    writeAllowed: isDoujinLocalWriteAllowed(),
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
    return NextResponse.json(doujinWriteDisabledJsonBody(), { status: 403 });
  }

  const rate = consumeAdminRateLimit("admin-doujin-import", 60);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSec: rate.retryAfterSec },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as {
      action?: "start" | "pause" | "resume" | "cancel" | "tick";
      jobType?: DoujinImportJobType;
      targetUniqueCount?: number;
      batchSize?: number;
      requestDelayMs?: number;
      dryRun?: boolean;
      site?: string;
      service?: string;
      floor?: string;
      jobId?: string;
    };

    if (body.action === "pause") {
      const job = requestPauseDoujinImport(body.jobId);
      return NextResponse.json({ ok: true, job, ...getDoujinImportOverview() });
    }

    if (body.action === "cancel") {
      const job = requestCancelDoujinImport(body.jobId);
      clearDoujinImportRunner(body.jobId);
      return NextResponse.json({ ok: true, job, ...getDoujinImportOverview() });
    }

    if (body.action === "tick") {
      const overview = getDoujinImportOverview();
      const jobId = body.jobId ?? overview.runningJobId;
      if (!jobId) {
        return NextResponse.json(
          { error: "No running import job" },
          { status: 400 },
        );
      }
      const slice = await processDoujinImportRequestSlice(jobId);
      if (!slice.continueRunning) {
        clearDoujinImportRunner(jobId);
      }
      return NextResponse.json({
        ok: true,
        job: slice.job,
        continueRunning: slice.continueRunning,
        persisted: slice.persisted,
        perf: slice.perf,
        ...getDoujinImportOverview(),
        stats: getDoujinCatalogStats(),
      });
    }

    if (body.action === "start" || body.action === "resume") {
      if (!body.jobType) {
        return NextResponse.json(
          { error: "jobType is required" },
          { status: 400 },
        );
      }

      try {
        const job = startDoujinImportJob(body.jobType, {
          targetUniqueCount: body.targetUniqueCount,
          batchSize: body.batchSize,
          requestDelayMs: body.requestDelayMs,
          dryRun: body.dryRun,
          resume: body.action === "resume",
          site: body.site,
          service: body.service,
          floor: body.floor,
        });

        ensureDoujinImportRunner(job.id);
        // 開始直後に1スライスだけ進める
        const slice = await processDoujinImportRequestSlice(job.id);
        if (!slice.continueRunning) {
          clearDoujinImportRunner(job.id);
        }

        return NextResponse.json({
          ok: true,
          job: slice.job,
          started: true,
          continueRunning: slice.continueRunning,
          persisted: slice.persisted,
          notice:
            "大量取得は最大500件ずつ実行されます。処理中に同じジョブを重複実行しないでください。",
          ...getDoujinImportOverview(),
          stats: getDoujinCatalogStats(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("実行中")) {
          return NextResponse.json({ error: message }, { status: 409 });
        }
        throw error;
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof DoujinLocalWriteDisabledError) {
      return NextResponse.json(doujinWriteDisabledJsonBody(), { status: 403 });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed",
      },
      { status: 400 },
    );
  }
}
