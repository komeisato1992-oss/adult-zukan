import "server-only";

import { dmmItemToStoredCandidate } from "@/lib/admin/import-candidate-mapper";
import type { ImportCollectionMode } from "@/lib/admin/import-collect-types";
import type { StoredImportCandidate } from "@/lib/admin/import-candidate-types";
import { buildImportSeoPopularityContext } from "@/lib/admin/import-seo-popularity";
import {
  compareSeoScoreDesc,
  computeImportSeoScore,
  type ImportSeoScoreFlags,
} from "@/lib/admin/import-seo-score";
import type { DmmItem } from "@/lib/dmm/types";

export type PendingImportCandidate = {
  item: DmmItem;
  source: string;
  collectionMode?: ImportCollectionMode;
  rankPosition?: number | null;
};

let cachedPopularityContext: Awaited<
  ReturnType<typeof buildImportSeoPopularityContext>
> | null = null;

export async function getImportSeoPopularityContext() {
  if (!cachedPopularityContext) {
    cachedPopularityContext = await buildImportSeoPopularityContext();
  }
  return cachedPopularityContext;
}

export function clearImportSeoPopularityCache(): void {
  cachedPopularityContext = null;
}

export function scorePendingImportCandidate(
  pending: PendingImportCandidate,
  context: Awaited<ReturnType<typeof buildImportSeoPopularityContext>>,
): StoredImportCandidate {
  const scored = computeImportSeoScore(
    {
      item: pending.item,
      source: pending.source,
      collectionMode: pending.collectionMode,
      rankPosition: pending.rankPosition,
    },
    context,
  );

  const base = dmmItemToStoredCandidate(pending.item, pending.source, {
    collectionMode: pending.collectionMode,
    rankPosition: pending.rankPosition,
  });

  return {
    ...base,
    seoScore: scored.seoScore,
    seoReasons: scored.seoReasons,
    seoFlags: scored.seoFlags,
  };
}

export function enrichStoredCandidateSeo(
  record: StoredImportCandidate,
  context: Awaited<ReturnType<typeof buildImportSeoPopularityContext>>,
): StoredImportCandidate {
  if (
    typeof record.seoScore === "number" &&
    Array.isArray(record.seoReasons) &&
    record.seoFlags
  ) {
    return record;
  }

  const scored = computeImportSeoScore(
    {
      item: record.item,
      source: record.source,
      collectionMode: record.collectionMode,
      rankPosition: record.rankPosition,
    },
    context,
  );

  return {
    ...record,
    seoScore: scored.seoScore,
    seoReasons: scored.seoReasons,
    seoFlags: scored.seoFlags,
  };
}

export async function scoreAndSortImportCandidates(
  pending: PendingImportCandidate[],
): Promise<StoredImportCandidate[]> {
  const context = await getImportSeoPopularityContext();
  const scored = pending.map((entry) =>
    scorePendingImportCandidate(entry, context),
  );

  return scored.sort((a, b) =>
    compareSeoScoreDesc(a.seoScore ?? 0, b.seoScore ?? 0),
  );
}

export async function enrichRecordsWithSeo(
  records: StoredImportCandidate[],
): Promise<StoredImportCandidate[]> {
  const context = await getImportSeoPopularityContext();
  return records.map((record) => enrichStoredCandidateSeo(record, context));
}

export type { ImportSeoScoreFlags };
