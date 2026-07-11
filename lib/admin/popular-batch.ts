import "server-only";

import { addWorksToCatalogInBatches } from "@/lib/admin/catalog-batch-add";
import {
  createBatchProcessId,
  type ImportBatchJob,
  type ImportBatchJobWorkEntry,
} from "@/lib/admin/import-batch-job";
import {
  claimImportBatchJob,
  releaseImportBatchJobLock,
  setBatchJobInProgress,
  updateImportBatchJob,
} from "@/lib/admin/import-batch-job-store";
import { collectImportCandidates } from "@/lib/admin/import-collect";
import type {
  PopularBatchCollectOptions,
  PopularBatchCollectResult,
} from "@/lib/admin/import-collect-types";
import { isImportCollectInProgress } from "@/lib/admin/import-collect";
import { getBranchHeadSha } from "@/lib/admin/github-catalog";
import { getPublishedWorkCount } from "@/lib/admin/stats";

function buildResultMessage(
  job: ImportBatchJob,
  addedCount: number,
): string {
  const lines = [
    "人気順バッチ収集が完了しました。",
    "",
    `処理ID：${job.processId}`,
    `追加成功：${addedCount.toLocaleString()}件`,
  ];

  if (job.runStats) {
    lines.push(
      `掲載済み：${job.runStats.skippedExistingCount.toLocaleString()}件`,
      `無効：${job.runStats.excludedCount.toLocaleString()}件`,
      `失敗：${job.runStats.failedCount.toLocaleString()}件`,
      `現在の総作品数：${job.currentCatalogCount.toLocaleString()}件`,
      `目標まで残り：${Math.max(0, job.targetTotalCount - job.currentCatalogCount).toLocaleString()}件`,
      `次回offset：${job.runStats.nextOffset.toLocaleString()}`,
    );
  }

  return lines.join("\n");
}

export async function runPopularBatchCollect(
  options: PopularBatchCollectOptions,
): Promise<PopularBatchCollectResult> {
  if (isImportCollectInProgress()) {
    throw new Error("別の収集処理が実行中です。完了までお待ちください。");
  }

  if (options.maxBatches > 1) {
    throw new Error(
      "連続自動実行は未対応です。1回の操作で1バッチのみ実行してください。",
    );
  }

  const addAfterCollect = options.addAfterCollect !== false;
  const idempotencyKey = options.idempotencyKey ?? null;

  console.log("batch start request", {
    idempotencyKey,
    mode: "popular",
    offset: options.startOffset ?? null,
    requestCount: options.requestCount,
    addAfterCollect,
    timestamp: new Date().toISOString(),
  });

  const startedAt = Date.now();
  const processId = createBatchProcessId();
  const startSha = await getBranchHeadSha().catch(() => null);
  const currentCatalogCount = await getPublishedWorkCount();

  let job: ImportBatchJob = {
    processId,
    activeJobId: processId,
    mode: "popular",
    idempotencyKey,
    status: "running",
    phase: "collecting",
    targetTotalCount: options.targetTotalCount,
    startOffset: options.startOffset ?? 1,
    requestCount: options.requestCount,
    addLimit: options.addLimit,
    maxBatches: options.maxBatches,
    batchesExecuted: 0,
    currentCatalogCount,
    works: [],
    runStats: null,
    progressMessage: "人気順から候補を取得中...",
    validatingProgress: 0,
    validatingTotal: 0,
    currentPage: 0,
    plannedPages: Math.ceil(options.requestCount / 100),
    currentOffset: options.startOffset ?? 1,
    fetchedCount: 0,
    estimatedRemainingCount: options.requestCount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    errorCode: null,
    startSha,
    saveSha: null,
    retryCount: 0,
    durationMs: null,
  };

  job = await claimImportBatchJob(job, idempotencyKey);
  setBatchJobInProgress(true);

  let lockReleased = false;

  try {
    const collectResult = await collectImportCandidates({
      mode: "popular",
      requestCount: options.requestCount,
      startOffset: options.startOffset,
      targetTotalCount: options.targetTotalCount,
      onProgress: async (progress) => {
        job = await updateImportBatchJob(
          processId,
          (current) => ({
            ...current,
            status: "running",
            activeJobId: processId,
            phase: "collecting",
            progressMessage: `現在処理中です（${progress.apiFetchedCount.toLocaleString()}件取得済み）`,
            currentPage: progress.currentPage,
            plannedPages: progress.plannedPages,
            currentOffset: progress.currentOffset,
            fetchedCount: progress.apiFetchedCount,
            estimatedRemainingCount: progress.estimatedRemainingCount,
          }),
          "Update popular batch fetch progress",
        );
      },
    });

    const runStats = collectResult.runStats;
    if (!runStats) {
      throw new Error("収集結果の統計を取得できませんでした。");
    }

    const worksToAdd = addAfterCollect
      ? (collectResult.collectedThisRun ?? collectResult.candidates ?? [])
          .slice(0, options.addLimit)
          .map((candidate) => ({
            contentId: candidate.contentId,
            item: candidate.item,
          }))
      : [];

    job = await updateImportBatchJob(
      processId,
      (current) => ({
        ...current,
        status: "running",
        activeJobId: processId,
        phase: addAfterCollect && worksToAdd.length > 0 ? "validating" : "saving",
        progressMessage: addAfterCollect
          ? "詳細取得・検証中..."
          : "候補保存完了",
        validatingTotal: worksToAdd.length,
        validatingProgress: 0,
        works: worksToAdd.map(
          (work): ImportBatchJobWorkEntry => ({
            contentId: work.contentId,
            status: "pending",
            item: work.item,
          }),
        ),
      }),
      "Popular batch validating",
    );

    let addResult:
      | PopularBatchCollectResult["addResult"]
      | undefined;
    let completionPatch: Partial<ImportBatchJob>;

    if (worksToAdd.length > 0) {
      job = await updateImportBatchJob(
        processId,
        (current) => ({
          ...current,
          status: "running",
          activeJobId: processId,
          phase: "github",
          progressMessage: "GitHub更新中...",
          validatingProgress: worksToAdd.length,
        }),
        "Popular batch github commit",
      );

      const batchAddResult = await addWorksToCatalogInBatches({
        works: worksToAdd,
        startOffset: runStats.startOffset,
        processId,
      });

      const updatedCatalogCount = await getPublishedWorkCount();

      addResult = {
        addedCount: batchAddResult.addedContentIds.length,
        skippedExistingCount: batchAddResult.duplicateContentIds.length,
        invalidCount: batchAddResult.invalidContentIds.length,
        failedCount: batchAddResult.failedContentIds.length,
        committedToGitHub: batchAddResult.committedToGitHub,
      };

      completionPatch = {
        status: "completed",
        phase: "completed",
        batchesExecuted: 1,
        currentCatalogCount: Math.max(
          updatedCatalogCount,
          currentCatalogCount + batchAddResult.addedContentIds.length,
        ),
        works: batchAddResult.workStatuses.map((entry) => ({
          contentId: entry.contentId,
          status: entry.status,
          errorCode: entry.errorCode,
        })),
        runStats: {
          requestedCount: runStats.requestedCount,
          apiFetchedCount: runStats.apiFetchedCount,
          validCandidateCount: runStats.validCandidateCount,
          addedCount: batchAddResult.addedContentIds.length,
          skippedExistingCount: batchAddResult.duplicateContentIds.length,
          excludedCount: batchAddResult.invalidContentIds.length,
          failedCount: batchAddResult.failedContentIds.length,
          startOffset: runStats.startOffset,
          nextOffset: runStats.nextOffset,
          exclusionStats: runStats.exclusionStats,
        },
        progressMessage: "完了",
        currentOffset: runStats.nextOffset,
        fetchedCount: runStats.apiFetchedCount,
        estimatedRemainingCount: 0,
        saveSha: batchAddResult.saveSha,
        retryCount: batchAddResult.retryCount,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      };
    } else {
      completionPatch = {
        status: "completed",
        phase: "completed",
        batchesExecuted: 1,
        runStats: {
          requestedCount: runStats.requestedCount,
          apiFetchedCount: runStats.apiFetchedCount,
          validCandidateCount: runStats.validCandidateCount,
          addedCount: 0,
          skippedExistingCount: runStats.exclusionStats.catalogPublished,
          excludedCount:
            runStats.exclusionStats.invalid +
            runStats.exclusionStats.duplicate,
          failedCount: 0,
          startOffset: runStats.startOffset,
          nextOffset: runStats.nextOffset,
          exclusionStats: runStats.exclusionStats,
        },
        progressMessage: addAfterCollect ? "候補なしで完了" : "候補取得のみ完了",
        currentOffset: runStats.nextOffset,
        fetchedCount: runStats.apiFetchedCount,
        estimatedRemainingCount: 0,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      };
    }

    job = await releaseImportBatchJobLock(processId, "completed", completionPatch);
    lockReleased = true;

    return {
      success: true,
      processId,
      message: buildResultMessage(job, addResult?.addedCount ?? 0),
      collectResult,
      addResult,
      job,
    };
  } catch (error) {
    if (!lockReleased) {
      try {
        job = await releaseImportBatchJobLock(processId, "failed", {
          errorCode: error instanceof Error ? error.message : "BATCH_FAILED",
          progressMessage: "失敗",
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
        });
        lockReleased = true;
      } catch {
        // 元のエラーを優先する。状態更新自体も競合リトライ済み。
      }
    }
    throw error;
  } finally {
    setBatchJobInProgress(false);

    if (!lockReleased) {
      try {
        await releaseImportBatchJobLock(processId, "failed", {
          errorCode: "BATCH_INTERRUPTED",
          progressMessage: "処理が中断されました。",
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
        });
      } catch {
        // ロック解除の最終試行。失敗してもメモリ上の inProgress は解除済み。
      }
    }
  }
}
