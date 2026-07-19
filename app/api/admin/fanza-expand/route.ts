import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { consumeAdminRateLimit } from "@/lib/admin/rate-limit";
import { FANZA_EXPAND_DEFAULT_TARGET } from "@/lib/admin/fanza-expand-config";
import {
  getFanzaExpandOverview,
  processFanzaExpandRequestSlice,
  requestCancelFanzaExpand,
  requestPauseFanzaExpand,
  startFanzaExpandJob,
} from "@/lib/admin/fanza-expand-service";
import type { FanzaExpandSource } from "@/lib/admin/fanza-expand-types";
import {
  AdultLocalWriteDisabledError,
  adultWriteDisabledJsonBody,
  isAdultLocalWriteAllowed,
} from "@/lib/dmm/write-guard";
import { isVercelRuntime } from "@/lib/admin/runtime-fs";

export const runtime = "nodejs";
/** 短いバッチのみ。長時間ループしない */
export const maxDuration = 60;

const SOURCE_SET = new Set<string>([
  "popular",
  "new",
  "genre",
  "maker",
  "label",
  "series",
  "actress",
]);

function parseSources(value: unknown): FanzaExpandSource[] | undefined {
  if (value == null) return undefined;
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const sources = list
    .map((item) => String(item).trim())
    .filter((item): item is FanzaExpandSource => SOURCE_SET.has(item));
  return sources.length > 0 ? sources : undefined;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overview = await getFanzaExpandOverview();
  return NextResponse.json({
    ok: true,
    ...overview,
  });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = consumeAdminRateLimit("admin-fanza-expand", 60);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSec: rate.retryAfterSec },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as {
      action?:
        | "start"
        | "pause"
        | "resume"
        | "cancel"
        | "tick"
        | "register";
      sourceOrder?: unknown;
      source?: unknown;
      targetCount?: number;
      batchSize?: number;
      dryRun?: boolean;
      jobId?: string;
    };

    const overviewBefore = await getFanzaExpandOverview();
    const localCliCommand =
      overviewBefore.localCliCommand ||
      `npm run fanza:expand -- --target=${FANZA_EXPAND_DEFAULT_TARGET}`;

    // Vercel 本番では重い取得を実行しない（ジョブ登録案内のみ）
    if (isVercelRuntime() && body.action !== "pause" && body.action !== "cancel") {
      return NextResponse.json(
        {
          ok: false,
          code: "RUN_LOCALLY",
          message:
            "本番Vercelでは大量取得を実行できません。Mac ローカルで次を実行してください。",
          ...overviewBefore,
          localCliCommand,
        },
        { status: 403 },
      );
    }

    if (!isAdultLocalWriteAllowed()) {
      return NextResponse.json(
        {
          ...adultWriteDisabledJsonBody({
            localCliCommand,
          }),
          ...overviewBefore,
        },
        { status: 403 },
      );
    }

    if (body.action === "pause") {
      const job = requestPauseFanzaExpand(body.jobId);
      return NextResponse.json({
        ok: true,
        ...(await getFanzaExpandOverview()),
        job,
      });
    }

    if (body.action === "cancel") {
      const job = requestCancelFanzaExpand(body.jobId);
      return NextResponse.json({
        ok: true,
        ...(await getFanzaExpandOverview()),
        job,
      });
    }

    if (body.action === "tick") {
      const slice = await processFanzaExpandRequestSlice({ forCli: false });
      return NextResponse.json({
        ok: true,
        continueRunning: slice.continueRunning,
        batchesRun: slice.batchesRun,
        ...(await getFanzaExpandOverview()),
        job: slice.job,
      });
    }

    if (
      body.action === "start" ||
      body.action === "resume" ||
      body.action === "register"
    ) {
      const sourceOrder =
        parseSources(body.sourceOrder) ?? parseSources(body.source);

      try {
        const job = startFanzaExpandJob({
          targetCount: body.targetCount,
          batchSize: body.batchSize,
          dryRun: body.dryRun,
          resume: body.action === "resume",
          sourceOrder,
          forCli: false,
        });

        // register はジョブ作成のみ（CLI 実行前提）
        if (body.action === "register") {
          const paused = requestPauseFanzaExpand(job.id);
          return NextResponse.json({
            ok: true,
            registered: true,
            ...(await getFanzaExpandOverview()),
            job: paused,
            localCliCommand: `npm run fanza:expand -- --target=${job.targetCount} --resume`,
            notice:
              "ジョブを登録しました。Mac で npm run fanza:expand -- --resume を実行してください。",
          });
        }

        const slice = await processFanzaExpandRequestSlice({ forCli: false });
        return NextResponse.json({
          ok: true,
          started: true,
          continueRunning: slice.continueRunning,
          batchesRun: slice.batchesRun,
          ...(await getFanzaExpandOverview()),
          job: slice.job,
          localCliCommand: `npm run fanza:expand -- --target=${job.targetCount} --resume`,
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
    if (error instanceof AdultLocalWriteDisabledError) {
      return NextResponse.json(adultWriteDisabledJsonBody(), { status: 403 });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Expand failed",
      },
      { status: 400 },
    );
  }
}
