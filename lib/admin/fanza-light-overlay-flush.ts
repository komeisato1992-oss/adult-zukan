import "server-only";

import {
  applyLoadedOverlayToItems,
  clearFanzaLightOverlay,
  loadFanzaLightOverlay,
} from "@/lib/admin/fanza-light-overlay-store";
import {
  commitCatalogBundleToGitHub,
  fetchCatalogFromGitHub,
} from "@/lib/admin/github-catalog";
import { commitChangedCatalogShardsToGitHub } from "@/lib/admin/github-catalog-shards";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import { filterPublicCatalogWorks } from "@/lib/dmm/catalog-visibility";
import { getCatalogManifest } from "@/lib/dmm/catalog-shards";
import {
  rebuildAllIndexes,
  serializeCatalogIndexes,
} from "@/lib/dmm/index-builders";

/**
 * 本番反映前: オーバーレイを作業ブランチのカタログへコミットし、オーバーレイを空にする。
 * 軽量同期だけではカタログJSONを触らないため、ここで初めて取り込む。
 */
export async function flushLightOverlayIntoWorkingCatalog(): Promise<{
  flushedCount: number;
}> {
  if (!isGitHubCatalogConfigured()) {
    return { flushedCount: 0 };
  }

  const overlay = await loadFanzaLightOverlay();
  if (Object.keys(overlay.entries).length === 0) {
    return { flushedCount: 0 };
  }

  const catalog = await fetchCatalogFromGitHub();
  const { items: mergedItems, flushedCount } = await applyLoadedOverlayToItems(
    catalog.items,
  );
  if (flushedCount === 0) {
    return { flushedCount: 0 };
  }

  const indexFiles = [
    ...serializeCatalogIndexes(
      rebuildAllIndexes(filterPublicCatalogWorks(mergedItems)),
    ),
  ];
  const manifest = getCatalogManifest();

  if (!manifest?.shards.length) {
    await commitCatalogBundleToGitHub(
      catalog.envelope,
      mergedItems,
      `Flush light sync overlay (${flushedCount} works)`,
      indexFiles,
      catalog.raw,
    );
  } else {
    await commitChangedCatalogShardsToGitHub({
      previousItems: catalog.items,
      nextItems: mergedItems,
      previousManifest: manifest,
      commitLabel: `Flush light sync overlay (${flushedCount} works)`,
      indexFiles,
    });
  }

  await clearFanzaLightOverlay();
  return { flushedCount };
}
