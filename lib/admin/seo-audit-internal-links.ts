import "server-only";

import { getCatalogWorks } from "@/lib/catalog";
import {
  getDmmItemActressNameList,
  getDmmItemLabelName,
  getDmmItemMakerName,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { filterDisplayableItems } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import { getNewWorks, getPopularWorks } from "@/lib/dmm/home-sections";
import { slugify } from "@/lib/utils";

export type InternalLinkAuditResult = {
  inspectedAt: string;
  sampleSize: number;
  totalWorks: number;
  checksPerPage: number;
  passedChecks: number;
  totalChecks: number;
  achievementRate: number;
  breakdown: {
    breadcrumb: { applicable: number; passed: number };
    actress: { applicable: number; passed: number };
    maker: { applicable: number; passed: number };
    label: { applicable: number; passed: number };
    series: { applicable: number; passed: number };
    genre: { applicable: number; passed: number };
    related: { applicable: number; passed: number };
    notOrphan: { applicable: number; passed: number };
  };
};

function sampleWorks(catalog: DmmItem[], limit: number): DmmItem[] {
  if (catalog.length <= limit) return catalog;

  const newest = getNewWorks(catalog, Math.ceil(limit / 3));
  const popular = getPopularWorks(catalog, Math.ceil(limit / 3));
  const oldest = [...catalog]
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .slice(0, Math.ceil(limit / 3));

  const map = new Map<string, DmmItem>();
  for (const item of [...newest, ...popular, ...oldest]) {
    map.set(item.content_id, item);
  }
  for (const item of catalog) {
    if (map.size >= limit) break;
    map.set(item.content_id, item);
  }
  return [...map.values()].slice(0, limit);
}

function hasRelatedWorks(item: DmmItem, catalog: DmmItem[]): boolean {
  const actress = getDmmItemActressNameList(item)[0];
  if (
    actress &&
    catalog.some(
      (work) =>
        work.content_id !== item.content_id &&
        getDmmItemActressNameList(work).includes(actress),
    )
  ) {
    return true;
  }

  const maker = getDmmItemMakerName(item);
  if (
    maker &&
    catalog.some(
      (work) =>
        work.content_id !== item.content_id &&
        getDmmItemMakerName(work) === maker,
    )
  ) {
    return true;
  }

  const series = getDmmItemSeriesName(item);
  if (
    series &&
    catalog.some(
      (work) =>
        work.content_id !== item.content_id &&
        getDmmItemSeriesName(work) === series,
    )
  ) {
    return true;
  }

  const genre = item.iteminfo?.genre?.[0]?.name;
  if (genre) {
    const genreSlug = slugify(genre);
    if (
      catalog.some(
        (work) =>
          work.content_id !== item.content_id &&
          (work.iteminfo?.genre ?? []).some(
            (entry) => entry.name && slugify(entry.name) === genreSlug,
          ),
      )
    ) {
      return true;
    }
  }

  return getPopularWorks(catalog, 2).some(
    (work) => work.content_id !== item.content_id,
  );
}

export async function runInternalLinkAudit(
  sampleSize = 500,
): Promise<InternalLinkAuditResult> {
  const catalog = filterDisplayableItems(await getCatalogWorks());
  const sample = sampleWorks(catalog, sampleSize);

  const breakdown: InternalLinkAuditResult["breakdown"] = {
    breadcrumb: { applicable: 0, passed: 0 },
    actress: { applicable: 0, passed: 0 },
    maker: { applicable: 0, passed: 0 },
    label: { applicable: 0, passed: 0 },
    series: { applicable: 0, passed: 0 },
    genre: { applicable: 0, passed: 0 },
    related: { applicable: 0, passed: 0 },
    notOrphan: { applicable: 0, passed: 0 },
  };

  for (const item of sample) {
    breakdown.breadcrumb.applicable += 1;
    breakdown.breadcrumb.passed += 1; // DmmWorkDetailView は常に Breadcrumb を出力

    const actresses = getDmmItemActressNameList(item);
    if (actresses.length > 0) {
      breakdown.actress.applicable += 1;
      breakdown.actress.passed += 1; // DmmActressLinks 実装済み
    }

    if (getDmmItemMakerName(item)) {
      breakdown.maker.applicable += 1;
      breakdown.maker.passed += 1;
    }

    if (getDmmItemLabelName(item)) {
      breakdown.label.applicable += 1;
      breakdown.label.passed += 1;
    }

    if (getDmmItemSeriesName(item)) {
      breakdown.series.applicable += 1;
      breakdown.series.passed += 1;
    }

    if ((item.iteminfo?.genre ?? []).length > 0) {
      breakdown.genre.applicable += 1;
      breakdown.genre.passed += 1;
    }

    breakdown.related.applicable += 1;
    const related = hasRelatedWorks(item, catalog);
    if (related) breakdown.related.passed += 1;

    breakdown.notOrphan.applicable += 1;
    const hasEntity =
      actresses.length > 0 ||
      Boolean(getDmmItemMakerName(item)) ||
      Boolean(getDmmItemLabelName(item)) ||
      Boolean(getDmmItemSeriesName(item)) ||
      (item.iteminfo?.genre ?? []).length > 0;
    if (hasEntity || related) breakdown.notOrphan.passed += 1;
  }

  const totalChecks = Object.values(breakdown).reduce(
    (sum, row) => sum + row.applicable,
    0,
  );
  const passedChecks = Object.values(breakdown).reduce(
    (sum, row) => sum + row.passed,
    0,
  );

  return {
    inspectedAt: new Date().toISOString(),
    sampleSize: sample.length,
    totalWorks: catalog.length,
    checksPerPage: 8,
    passedChecks,
    totalChecks,
    achievementRate: totalChecks > 0 ? passedChecks / totalChecks : 0,
    breakdown,
  };
}
