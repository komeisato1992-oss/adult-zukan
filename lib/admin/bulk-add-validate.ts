import "server-only";

import type { BulkAddWorkInput } from "@/lib/admin/bulk-add-request";
import {
  type BulkAddInvalidCandidate,
  getCandidateContentId,
  safeParseUrl,
  validateCandidateIdentity,
} from "@/lib/admin/bulk-add-safe";

export type BulkAddValidationSummary = {
  valid: BulkAddWorkInput[];
  invalid: BulkAddInvalidCandidate[];
  batches: Array<{
    startIndex: number;
    endIndex: number;
    successCount: number;
    excludedCount: number;
    failedIds: string[];
  }>;
};

function logInvalidCandidate(invalid: BulkAddInvalidCandidate): void {
  console.warn("[bulk-add] invalid candidate", {
    contentId: invalid.contentId,
    productId: invalid.productId,
    title: invalid.title,
    reason: invalid.reason,
    stage: invalid.stage,
  });
}

const BULK_ADD_VALIDATION_BATCH_SIZE = 50;

export function validateBulkAddWorksInBatches(
  works: BulkAddWorkInput[],
  batchSize = BULK_ADD_VALIDATION_BATCH_SIZE,
): BulkAddValidationSummary {
  const valid: BulkAddWorkInput[] = [];
  const invalid: BulkAddInvalidCandidate[] = [];
  const batches: BulkAddValidationSummary["batches"] = [];

  for (let start = 0; start < works.length; start += batchSize) {
    const slice = works.slice(start, start + batchSize);
    const endIndex = start + slice.length;
    const batchInvalid: BulkAddInvalidCandidate[] = [];
    const batchValid: BulkAddWorkInput[] = [];

    console.log("[bulk-add] validate batch", {
      startIndex: start + 1,
      endIndex,
      batchSize: slice.length,
    });

    for (const work of slice) {
      try {
        const identityIssue = validateCandidateIdentity(work.item, work.contentId);
        if (identityIssue) {
          batchInvalid.push(identityIssue);
          logInvalidCandidate(identityIssue);
          continue;
        }

        if (!work.item?.title?.trim()) {
          const missingTitle: BulkAddInvalidCandidate = {
            contentId: getCandidateContentId(work.item),
            productId: work.item.product_id,
            title: work.item.title,
            reason: "missing title",
            stage: "candidate validation",
          };
          batchInvalid.push(missingTitle);
          logInvalidCandidate(missingTitle);
          continue;
        }

        batchValid.push(work);
      } catch (error) {
        const failed: BulkAddInvalidCandidate = {
          contentId: getCandidateContentId(work.item),
          productId: work.item?.product_id,
          title: work.item?.title,
          reason: error instanceof Error ? error.message : String(error),
          stage: "candidate validation",
        };
        batchInvalid.push(failed);
        logInvalidCandidate(failed);
      }
    }

    valid.push(...batchValid);
    invalid.push(...batchInvalid);
    batches.push({
      startIndex: start + 1,
      endIndex,
      successCount: batchValid.length,
      excludedCount: batchInvalid.length,
      failedIds: batchInvalid.map((entry) => entry.contentId).filter(Boolean),
    });
  }

  console.log("[bulk-add] validate complete", {
    inputCount: works.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    batchCount: batches.length,
  });

  return { valid, invalid, batches };
}
