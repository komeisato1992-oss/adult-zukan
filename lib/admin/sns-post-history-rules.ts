import "server-only";

import type { SnsPostHistoryEntry } from "@/lib/admin/sns-post-history-types";
import type { SnsPostType } from "@/lib/admin/sns-types";
import { comparePairKey } from "@/lib/admin/sns-compare-pairs";
import { SNS_POST_COOLDOWN_DAYS } from "@/lib/admin/sns-post-history-display";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SnsPostHistoryExclusions = {
  excludedContentIds: Set<string>;
  excludedCompareKeys: Set<string>;
  excludedActressNames: Set<string>;
  excludedGenreNames: Set<string>;
};

function isWithinCooldown(postedAt: string, days: number, now = Date.now()): boolean {
  const postedTime = new Date(postedAt).getTime();
  if (Number.isNaN(postedTime)) return false;
  return now - postedTime < days * MS_PER_DAY;
}

export function buildHistoryExclusions(
  history: SnsPostHistoryEntry[],
  now = Date.now(),
): SnsPostHistoryExclusions {
  const excludedContentIds = new Set<string>();
  const excludedCompareKeys = new Set<string>();
  const excludedActressNames = new Set<string>();
  const excludedGenreNames = new Set<string>();

  for (const entry of history) {
    const cooldownDays = SNS_POST_COOLDOWN_DAYS[entry.postType as SnsPostType];
    if (!cooldownDays) continue;
    if (!isWithinCooldown(entry.postedAt, cooldownDays, now)) continue;

    if (entry.postType === "recommended-work" && entry.contentId) {
      excludedContentIds.add(entry.contentId);
    }

    if (
      entry.postType === "compare" &&
      entry.compareIds?.length === 2
    ) {
      excludedCompareKeys.add(
        comparePairKey(entry.compareIds[0], entry.compareIds[1]),
      );
    }

    if (entry.postType === "actress" && entry.actressName) {
      excludedActressNames.add(entry.actressName);
    }

    if (entry.postType === "genre" && entry.genreName) {
      excludedGenreNames.add(entry.genreName);
    }
  }

  return {
    excludedContentIds,
    excludedCompareKeys,
    excludedActressNames,
    excludedGenreNames,
  };
}
