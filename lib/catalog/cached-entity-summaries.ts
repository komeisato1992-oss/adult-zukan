import "server-only";

import { unstable_cache } from "next/cache";
import {
  getCatalogGenres,
  getCatalogLabels,
  getCatalogMakers,
  getCatalogSeries,
} from "@/lib/dmm/catalog-entities";
import { getCatalogWorks } from "@/lib/catalog";

/** エンティティ一覧用の軽量要約（6時間キャッシュ） */
export async function getCachedMakerSummaries() {
  const cached = unstable_cache(
    async () => {
      const items = await getCatalogWorks();
      return getCatalogMakers(items).sort(
        (a, b) =>
          b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
      );
    },
    ["public-maker-summaries-v1"],
    { revalidate: 21600, tags: ["public-entity-summaries"] },
  );
  try {
    return await cached();
  } catch {
    const items = await getCatalogWorks();
    return getCatalogMakers(items);
  }
}

export async function getCachedGenreSummaries() {
  const cached = unstable_cache(
    async () => {
      const items = await getCatalogWorks();
      return getCatalogGenres(items);
    },
    ["public-genre-summaries-v1"],
    { revalidate: 21600, tags: ["public-entity-summaries"] },
  );
  try {
    return await cached();
  } catch {
    const items = await getCatalogWorks();
    return getCatalogGenres(items);
  }
}

export async function getCachedSeriesSummaries() {
  const cached = unstable_cache(
    async () => {
      const items = await getCatalogWorks();
      return getCatalogSeries(items);
    },
    ["public-series-summaries-v1"],
    { revalidate: 21600, tags: ["public-entity-summaries"] },
  );
  try {
    return await cached();
  } catch {
    const items = await getCatalogWorks();
    return getCatalogSeries(items);
  }
}

export async function getCachedLabelSummaries() {
  const cached = unstable_cache(
    async () => {
      const items = await getCatalogWorks();
      return getCatalogLabels(items);
    },
    ["public-label-summaries-v1"],
    { revalidate: 21600, tags: ["public-entity-summaries"] },
  );
  try {
    return await cached();
  } catch {
    const items = await getCatalogWorks();
    return getCatalogLabels(items);
  }
}
