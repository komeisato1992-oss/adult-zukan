import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  parseCollectRequestCount,
  parseCollectStartOffset,
} from "@/lib/admin/import-collect-params";
import { loadImportCollectionState } from "@/lib/admin/import-collection-state-store";
import {
  IMPORT_POPULAR_ADD_LIMIT,
  IMPORT_POPULAR_MAX_BATCHES,
  IMPORT_POPULAR_TARGET_COUNT,
} from "@/lib/admin/import-constants";
import { runPopularBatchCollect } from "@/lib/admin/popular-batch";
import { isDmmConfigured } from "@/lib/dmm/client";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import { ImportBatchJobConflictError } from "@/lib/admin/import-batch-job-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseTargetTotalCount(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return IMPORT_POPULAR_TARGET_COUNT;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 50000) {
    throw new Error("目標総作品数は1〜50000の整数で指定してください。");
  }

  return numeric;
}

function parseAddLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return IMPORT_POPULAR_ADD_LIMIT;
  }

  const numeric = Number(value);
  const allowed = new Set([50, 100, 200, 500, 1000]);
  if (!allowed.has(numeric)) {
    throw new Error("追加上限は50, 100, 200, 500, 1000のいずれかです。");
  }

  return numeric;
}

function parseMaxBatches(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return IMPORT_POPULAR_MAX_BATCHES;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 1) {
    throw new Error("最大実行バッチ数は1のみ指定できます。");
  }

  return numeric;
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      targetTotalCount?: unknown;
      startOffset?: unknown;
      requestCount?: unknown;
      addLimit?: unknown;
      maxBatches?: unknown;
      addAfterCollect?: boolean;
    };

    const { state } = await loadImportCollectionState();
    const targetTotalCount = parseTargetTotalCount(body.targetTotalCount);
    const requestCount = parseCollectRequestCount(body.requestCount);
    const startOffset = parseCollectStartOffset(
      body.startOffset,
      state.popularOffset,
    );
    const addLimit = parseAddLimit(body.addLimit);
    const maxBatches = parseMaxBatches(body.maxBatches);
    const addAfterCollect = body.addAfterCollect !== false;

    const result = await runPopularBatchCollect({
      targetTotalCount,
      startOffset,
      requestCount,
      addLimit,
      maxBatches,
    });

    if (!addAfterCollect) {
      return NextResponse.json({
        success: true,
        processId: result.processId,
        message: result.collectResult?.message,
        collectResult: result.collectResult,
        job: result.job,
        configured: isGitHubCatalogConfigured(),
        dmmConfigured: isDmmConfigured(),
      });
    }

    return NextResponse.json({
      success: true,
      processId: result.processId,
      message: result.message,
      collectResult: result.collectResult,
      addResult: result.addResult,
      job: result.job,
      configured: isGitHubCatalogConfigured(),
      dmmConfigured: isDmmConfigured(),
    });
  } catch (error) {
    const status = error instanceof ImportBatchJobConflictError ? 409 : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "人気順バッチ収集に失敗しました。",
      },
      { status },
    );
  }
}
