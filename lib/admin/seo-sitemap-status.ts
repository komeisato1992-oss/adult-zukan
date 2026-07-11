import "server-only";

import {
  buildSitemapDefinitions,
  type SitemapDefinition,
} from "@/lib/sitemap/definitions";
import { getSitemapGenerationMeta } from "@/lib/sitemap/manage";
import { getLastGoogleSitemapSubmission } from "@/lib/admin/sitemap-google-submit";
import type {
  SeoEntityPageCounts,
  SeoEntitySitemapStatus,
  SeoSitemapRow,
  SeoSitemapStatusSnapshot,
} from "@/lib/admin/seo-types";

export { buildSitemapDefinitions as SEO_ENTITY_SITEMAP_DEFINITIONS };

function normalizeSitemapPath(value: string): string {
  try {
    const parsed = new URL(value);
    return parsed.pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return value.replace(/\/+$/, "").toLowerCase();
  }
}

function findMatchingSitemapRow(
  rows: SeoSitemapRow[],
  definition: SitemapDefinition,
): SeoSitemapRow | null {
  const normalizedPath = normalizeSitemapPath(definition.url);
  return (
    rows.find((row) => normalizeSitemapPath(row.path) === normalizedPath) ??
    rows.find((row) =>
      normalizeSitemapPath(row.path).endsWith(
        definition.pathname.toLowerCase(),
      ),
    ) ??
    null
  );
}

function mapLocalCount(
  definition: SitemapDefinition,
  entityPageCounts: SeoEntityPageCounts,
): number {
  switch (definition.entityKey) {
    case "works":
      return entityPageCounts.works;
    case "actresses":
      return entityPageCounts.actresses;
    case "makers":
      return entityPageCounts.makers;
    case "labels":
      return entityPageCounts.labels;
    case "series":
      return entityPageCounts.series;
    case "genres":
      return entityPageCounts.genres;
    default:
      return 0;
  }
}

export function buildEntitySitemapStatuses(options: {
  siteUrl: string;
  gscRows: SeoSitemapRow[];
  entityPageCounts: SeoEntityPageCounts;
  worksCount: number;
  fetchedAt: string | null;
  fetchError?: string;
}): SeoSitemapStatusSnapshot {
  const definitions = buildSitemapDefinitions({
    siteUrl: options.siteUrl,
    worksCount: options.worksCount,
  }).filter((definition) => definition.key !== "index");

  const googleSubmission = getLastGoogleSitemapSubmission();

  const rows: SeoEntitySitemapStatus[] = definitions.map((definition) => {
    const generation = getSitemapGenerationMeta(definition.key);
    const localCount = mapLocalCount(definition, options.entityPageCounts);
    const match = options.fetchError
      ? null
      : findMatchingSitemapRow(options.gscRows, definition);

    if (options.fetchError) {
      return {
        id: definition.key,
        label: definition.label,
        displayName: definition.label,
        pathSuffix: definition.pathname,
        submitUrl: definition.url,
        kind: definition.kind,
        status: "fetch_error",
        siteUrlCount: generation?.urlCount ?? null,
        indexedCount: null,
        contentsCount: null,
        notIndexedCount: null,
        lastGeneratedAt: generation?.generatedAt ?? null,
        lastSubmitted: null,
        lastDownloaded: null,
        googleSubmittedAt: googleSubmission.submittedAt,
        errors: 0,
        warnings: 0,
        isPending: null,
        httpStatus: null,
        localCount,
        coverageRate: null,
      };
    }

    if (!match) {
      return {
        id: definition.key,
        label: definition.label,
        displayName: definition.label,
        pathSuffix: definition.pathname,
        submitUrl: definition.url,
        kind: definition.kind,
        status: "pending",
        siteUrlCount: generation?.urlCount ?? null,
        indexedCount: null,
        contentsCount: null,
        notIndexedCount: null,
        lastGeneratedAt: generation?.generatedAt ?? null,
        lastSubmitted: null,
        lastDownloaded: null,
        googleSubmittedAt: googleSubmission.submittedAt,
        errors: 0,
        warnings: 0,
        isPending: null,
        httpStatus: null,
        localCount,
        coverageRate: null,
      };
    }

    const indexedCount = match.indexedCount;
    const contentsCount = match.contentsCount;
    const notIndexedCount =
      contentsCount > indexedCount ? contentsCount - indexedCount : 0;
    const siteUrlCount = generation?.urlCount ?? contentsCount;
    const coverageRate =
      localCount > 0 && indexedCount > 0 ? indexedCount / localCount : null;

    return {
      id: definition.key,
      label: definition.label,
      displayName: definition.label,
      pathSuffix: definition.pathname,
      submitUrl: match.path || definition.url,
      kind: definition.kind,
      status: match.errors > 0 ? "fetch_error" : "success",
      siteUrlCount,
      indexedCount,
      contentsCount,
      notIndexedCount,
      lastGeneratedAt: generation?.generatedAt ?? null,
      lastSubmitted: match.lastSubmitted ?? null,
      lastDownloaded: match.lastDownloaded ?? null,
      googleSubmittedAt: googleSubmission.submittedAt,
      errors: match.errors,
      warnings: match.warnings,
      isPending: null,
      httpStatus: match.errors > 0 ? 400 : 200,
      localCount,
      coverageRate,
    };
  });

  return {
    fetchedAt: options.fetchedAt,
    fetchError: options.fetchError,
    rows,
  };
}

export function createEmptySitemapStatusSnapshot(
  siteUrl: string,
  entityPageCounts: SeoEntityPageCounts,
  worksCount = 0,
): SeoSitemapStatusSnapshot {
  return buildEntitySitemapStatuses({
    siteUrl,
    gscRows: [],
    entityPageCounts,
    worksCount,
    fetchedAt: null,
  });
}
