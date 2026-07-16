import "server-only";

import type { FetchedImportCandidate } from "@/lib/admin/import-simple-types";
import {
  detectAdultImageStatusMany,
  type AdultImageStatus,
} from "@/lib/works/image-status";
import { pickPackageImageCandidate } from "@/lib/works/package-image";

export type CandidateImageCheckStats = {
  total: number;
  okCount: number;
  nowPrintingCount: number;
  fetchFailedCount: number;
  noUrlCount: number;
  /** GET を実行したユニークURL数（URL文字列だけで判定したものは含まない） */
  imageGetCount: number;
  checkedSuccessCount: number;
  message: string;
};

export type CandidateImageCheckResult = {
  candidates: FetchedImportCandidate[];
  stats: CandidateImageCheckStats;
};

function buildStatsMessage(stats: CandidateImageCheckStats): string {
  const failed =
    stats.nowPrintingCount + stats.fetchFailedCount + stats.noUrlCount;
  const success = stats.okCount;
  if (failed === 0) {
    return `${stats.total}件すべての画像確認に成功しました。`;
  }
  return `${stats.total}件中${success}件の画像確認に成功しました。${failed}件は選択解除されています。`;
}

/**
 * 候補取得直後の画像判定（候補作品のみ・最大1回/URL）。
 * 一部失敗しても全体は失敗にしない。
 */
export async function checkImportCandidateImages(
  candidates: FetchedImportCandidate[],
  options?: { concurrency?: number },
): Promise<CandidateImageCheckResult> {
  const concurrency = options?.concurrency ?? 3;
  const packageImages = candidates.map((c) =>
    pickPackageImageCandidate(c.item),
  );

  let statusResults: Awaited<ReturnType<typeof detectAdultImageStatusMany>>;
  try {
    statusResults = await detectAdultImageStatusMany(
      packageImages,
      concurrency,
    );
  } catch (error) {
    console.warn("[check-import-candidate-images] batch failed", error);
    const checkedAt = new Date().toISOString();
    statusResults = candidates.map((_, i) => ({
      status: (packageImages[i]
        ? "fetch_failed"
        : "fetch_failed") as AdultImageStatus,
      checkedAt,
      fetched: Boolean(packageImages[i]),
      finalUrl: packageImages[i],
    }));
  }

  let okCount = 0;
  let nowPrintingCount = 0;
  let fetchFailedCount = 0;
  let noUrlCount = 0;
  let imageGetCount = 0;

  const nextCandidates = candidates.map((candidate, index) => {
    const packageImage = packageImages[index];
    const detected = statusResults[index] ?? {
      status: "fetch_failed" as AdultImageStatus,
      checkedAt: new Date().toISOString(),
      fetched: false,
    };
    const imageUrlMissing = !packageImage;
    let imageStatus: AdultImageStatus = detected.status;
    if (imageUrlMissing) {
      imageStatus = "fetch_failed";
      noUrlCount += 1;
    } else if (imageStatus === "ok") {
      okCount += 1;
    } else if (imageStatus === "now_printing") {
      nowPrintingCount += 1;
    } else {
      fetchFailedCount += 1;
    }
    if (detected.fetched) imageGetCount += 1;

    return {
      ...candidate,
      packageImage,
      imageStatus,
      imageStatusCheckedAt: detected.checkedAt,
      imageUrlMissing,
    };
  });

  // imageGetCount counts per-candidate fetched flag; after URL cache sharing,
  // multiple candidates may share one GET — recount unique fetched URLs.
  const fetchedKeys = new Set<string>();
  for (let i = 0; i < packageImages.length; i += 1) {
    const url = packageImages[i]?.trim();
    if (url && statusResults[i]?.fetched) fetchedKeys.add(url);
  }
  imageGetCount = fetchedKeys.size;

  const stats: CandidateImageCheckStats = {
    total: nextCandidates.length,
    okCount,
    nowPrintingCount,
    fetchFailedCount,
    noUrlCount,
    imageGetCount,
    checkedSuccessCount: okCount,
    message: "",
  };
  stats.message = buildStatsMessage(stats);

  return { candidates: nextCandidates, stats };
}

export function initialSelectedContentIds(
  candidates: FetchedImportCandidate[],
): string[] {
  return candidates
    .filter((c) => c.imageStatus === "ok" && !c.imageUrlMissing)
    .map((c) => c.contentId);
}
