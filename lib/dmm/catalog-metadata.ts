import type { DmmItem } from "@/lib/dmm/types";

export type CatalogItemMetadataInput = {
  sourcePopularityRank?: number | null;
  popularityUpdatedAt?: string;
  addedAt?: string;
};

export function enrichCatalogItemMetadata(
  item: DmmItem,
  metadata: CatalogItemMetadataInput = {},
): DmmItem {
  const now = new Date().toISOString();
  const next: DmmItem = {
    ...item,
    addedAt: item.addedAt ?? metadata.addedAt ?? now,
  };

  const rank =
    metadata.sourcePopularityRank ??
    (typeof item.sourcePopularityRank === "number" &&
    Number.isFinite(item.sourcePopularityRank) &&
    item.sourcePopularityRank > 0
      ? item.sourcePopularityRank
      : undefined);

  if (typeof rank === "number" && rank > 0) {
    next.sourcePopularityRank = rank;
    next.popularityUpdatedAt =
      metadata.popularityUpdatedAt ?? item.popularityUpdatedAt ?? now;
  }

  return next;
}

export function assignSourcePopularityRank(
  item: DmmItem,
  rank: number,
  updatedAt = new Date().toISOString(),
): DmmItem {
  if (!Number.isFinite(rank) || rank <= 0) {
    return item;
  }

  return enrichCatalogItemMetadata(item, {
    sourcePopularityRank: Math.floor(rank),
    popularityUpdatedAt: updatedAt,
  });
}
