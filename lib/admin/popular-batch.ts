import "server-only";

import { addWorksToCatalogInBatches } from "@/lib/admin/catalog-batch-add";
import {
  createBatchProcessId,
  type ImportBatchJob,
  type ImportBatchJobWorkEntry,
} from "@/lib/admin/import-batch-job";
import {
  isBatchJobInProgress,
  loadImportBatchJob,
  saveImportBatchJob,
  setBatchJobInProgress,
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
  if (isImportCollectInProgress() || isBatchJobInProgress()) {
    throw new Error("別の収集処理が実行中です。完了までお待ちください。");
  }

  if (options.maxBatches > 1) {
    throw new Error(
      "連続自動実行は未対応です。1回の操作で1バッチのみ実行してください。",
    );
  }

  setBatchJobInProgress(true);
  const startedAt = Date.now();
  const processId = createBatchProcessId();
  const startSha = await getBranchHeadSha().catch(() => null);
  const currentCatalogCount = await getPublishedWorkCount();

  const { job: previousJob, sha: jobSha } = await loadImportBatchJob();

  let job: ImportBatchJob = {
    ...previousJob,
    processId,
    phase: "collecting",
    targetTotalCount: options.targetTotalCount,
    startOffset: options.startOffset ?? previousJob.startOffset,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    errorCode: null,
    startSha,
    saveSha: null,
    retryCount: 0,
    durationMs: null,
  };

  await saveImportBatchJob(job, jobSha, "Start popular batch collect");

  try {
    const collectResult = await collectImportCandidates({
      mode: "popular",
      requestCount: options.requestCount,
      startOffset: options.startOffset,
      targetTotalCount: options.targetTotalCount,
    });

    if (!collectResult.runStats) {
      throw new Error("収集結果の統計を取得できませんでした。");
    }

    const worksToAdd = (collectResult.collectedThisRun ?? collectResult.candidates ?? [])
      .slice(0, options.addLimit)
      .map((candidate) => ({
        contentId: candidate.contentId,
        item: candidate.item,
      }));

    job = {
      ...job,
      phase: "validating",
      progressMessage: "詳細取得・検証中...",
      validatingTotal: worksToAdd.length,
      works: worksToAdd.map(
        (work): ImportBatchJobWorkEntry => ({
          contentId: work.contentId,
          status: "pending",
          item: work.item,
        }),
      ),
      updatedAt: new Date().toISOString(),
    };
    await saveImportBatchJob(job, jobSha, "Popular batch validating");

    let addResult:
      | PopularBatchCollectResult["addResult"]
      | undefined;

    if (worksToAdd.length > 0) {
      job = {
        ...job,
        phase: "github",
        progressMessage: "GitHub更新中...",
        updatedAt: new Date().toISOString(),
      };
      await saveImportBatchJob(job, jobSha, "Popular batch github commit");

      const batchAddResult = await addWorksToCatalogInBatches({
        works: worksToAdd,
        startOffset: collectResult.runStats.startOffset,
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

      job = {
        ...job,
        phase: "completed",
        batchesExecuted: 1,
        currentCatalogCount: updatedCatalogCount,
        works: batchAddResult.workStatuses.map((entry) => ({
          contentId: entry.contentId,
          status: entry.status,
          errorCode: entry.errorCode,
        })),
        runStats: {
          requestedCount: collectResult.runStats.requestedCount,
          apiFetchedCount: collectResult.runStats.apiFetchedCount,
          validCandidateCount: collectResult.runStats.validCandidateCount,
          addedCount: batchAddResult.addedContentIds.length,
          skippedExistingCount: batchAddResult.duplicateContentIds.length,
          excludedCount: batchAddResult.invalidContentIds.length,
          failedCount: batchAddResult.failedContentIds.length,
          startOffset: collectResult.runStats.startOffset,
          nextOffset: collectResult.runStats.nextOffset,
          exclusionStats: collectResult.runStats.exclusionStats,
        },
        progressMessage: "完了",
        saveSha: batchAddResult.saveSha,
        retryCount: batchAddResult.retryCount,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      };
    } else {
      job = {
        ...job,
        phase: "completed",
        batchesExecuted: 1,
        runStats: {
          requestedCount: collectResult.runStats.requestedCount,
          apiFetchedCount: collectResult.runStats.apiFetchedCount,
          validCandidateCount: 0,
          addedCount: 0,
          skippedExistingCount: collectResult.runStats.exclusionStats.catalogPublished,
          excludedCount:
            collectResult.runStats.exclusionStats.invalid +
            collectResult.runStats.exclusionStats.duplicate,
          failedCount: 0,
          startOffset: collectResult.runStats.startOffset,
          nextOffset: collectResult.runStats.nextOffset,
          exclusionStats: collectResult.runStats.exclusionStats,
        },
        progressMessage: "候補なしで完了",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      };
    }

    await saveImportBatchJob(job, jobSha, "Complete popular batch collect");

    return {
      success: true,
      processId,
      message: buildResultMessage(job, addResult?.addedCount ?? 0),
      collectResult,
      addResult,
      job,
    };
  } catch (error) {
    job = {
      ...job,
      phase: "failed",
      errorCode: error instanceof Error ? error.message : "BATCH_FAILED",
      progressMessage: "失敗",
      updatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    };
    await saveImportBatchJob(job, jobSha, "Popular batch failed");
    throw error;
  } finally {
    setBatchJobInProgress(false);
  }
}
