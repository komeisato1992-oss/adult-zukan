import type { CatalogFilterStats } from "@/lib/dmm/catalog-filter-stats";

type CatalogBuildLogExtra = {
  worksListCount?: number;
  staticParamsCount?: number;
};

export function logCatalogBuildStats(
  stats: CatalogFilterStats,
  extra: CatalogBuildLogExtra = {},
): void {
  console.log("=== カタログビルド統計 ===");
  console.log(`API取得総数: ${stats.apiTotal}`);
  console.log(`除外数: ${stats.excluded}`);
  console.log(`  - content_idなし: ${stats.noContentId}`);
  console.log(`  - titleなし: ${stats.noTitle}`);
  console.log(`  - NOW PRINTING: ${stats.nowPrinting}`);
  console.log(`  - 画像なし/noimage: ${stats.noImage}`);
  console.log(`  - その他: ${stats.other}`);
  console.log(`有効作品数: ${stats.validCount}`);

  if (extra.worksListCount !== undefined) {
    console.log(`/works表示対象件数: ${extra.worksListCount}`);
  }

  if (extra.staticParamsCount !== undefined) {
    console.log(`generateStaticParams件数: ${extra.staticParamsCount}`);
  }

  console.log("==========================");
}
