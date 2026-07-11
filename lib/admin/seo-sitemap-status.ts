import type {
  SeoEntityPageCounts,
  SeoEntitySitemapDefinition,
  SeoEntitySitemapStatus,
  SeoSitemapRow,
  SeoSitemapStatusSnapshot,
} from "@/lib/admin/seo-types";

export const SEO_ENTITY_SITEMAP_DEFINITIONS: SeoEntitySitemapDefinition[] = [
  { id: "works", label: "作品", pathSuffix: "sitemap-works.xml" },
  { id: "actresses", label: "女優", pathSuffix: "sitemap-actresses.xml" },
  { id: "makers", label: "メーカー", pathSuffix: "sitemap-makers.xml" },
  { id: "labels", label: "レーベル", pathSuffix: "sitemap-labels.xml" },
  { id: "series", label: "シリーズ", pathSuffix: "sitemap-series.xml" },
  { id: "genres", label: "ジャンル", pathSuffix: "sitemap-genres.xml" },
];

function normalizeSitemapPath(value: string): string {
  try {
    const parsed = new URL(value);
    return parsed.pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return value.replace(/\/+$/, "").toLowerCase();
  }
}

function buildSubmitUrl(siteUrl: string, pathSuffix: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/${pathSuffix}`;
}

function findMatchingSitemapRow(
  rows: SeoSitemapRow[],
  pathSuffix: string,
): SeoSitemapRow | null {
  const normalizedSuffix = pathSuffix.toLowerCase();
  return (
    rows.find((row) =>
      normalizeSitemapPath(row.path).endsWith(normalizedSuffix),
    ) ?? null
  );
}

export function buildEntitySitemapStatuses(options: {
  siteUrl: string;
  gscRows: SeoSitemapRow[];
  entityPageCounts: SeoEntityPageCounts;
  fetchedAt: string | null;
  fetchError?: string;
}): SeoSitemapStatusSnapshot {
  const rows: SeoEntitySitemapStatus[] = SEO_ENTITY_SITEMAP_DEFINITIONS.map(
    (definition) => {
      const submitUrl = buildSubmitUrl(options.siteUrl, definition.pathSuffix);
      const match = findMatchingSitemapRow(
        options.gscRows,
        definition.pathSuffix,
      );
      const localCount = options.entityPageCounts[definition.id];

      if (options.fetchError) {
        return {
          id: definition.id,
          label: definition.label,
          displayName: `${definition.label} sitemap.xml`,
          pathSuffix: definition.pathSuffix,
          submitUrl,
          status: "fetch_error",
          indexedCount: null,
          contentsCount: null,
          notIndexedCount: null,
          lastSubmitted: null,
          lastDownloaded: null,
          errors: 0,
          warnings: 0,
          httpStatus: null,
          localCount,
          coverageRate: null,
        };
      }

      if (!match) {
        return {
          id: definition.id,
          label: definition.label,
          displayName: `${definition.label} sitemap.xml`,
          pathSuffix: definition.pathSuffix,
          submitUrl,
          status: "pending",
          indexedCount: null,
          contentsCount: null,
          notIndexedCount: null,
          lastSubmitted: null,
          lastDownloaded: null,
          errors: 0,
          warnings: 0,
          httpStatus: null,
          localCount,
          coverageRate: null,
        };
      }

      const indexedCount = match.indexedCount;
      const contentsCount = match.contentsCount;
      const notIndexedCount =
        contentsCount > indexedCount ? contentsCount - indexedCount : 0;
      const coverageRate =
        localCount > 0 ? indexedCount / localCount : null;

      return {
        id: definition.id,
        label: definition.label,
        displayName: `${definition.label} sitemap.xml`,
        pathSuffix: definition.pathSuffix,
        submitUrl: match.path || submitUrl,
        status: match.errors > 0 ? "fetch_error" : "success",
        indexedCount,
        contentsCount,
        notIndexedCount,
        lastSubmitted: match.lastSubmitted ?? null,
        lastDownloaded: match.lastDownloaded ?? null,
        errors: match.errors,
        warnings: match.warnings,
        httpStatus: match.errors > 0 ? 400 : 200,
        localCount,
        coverageRate,
      };
    },
  );

  return {
    fetchedAt: options.fetchedAt,
    fetchError: options.fetchError,
    rows,
  };
}

export function countSubmittedSitemaps(
  snapshot: SeoSitemapStatusSnapshot,
): { submitted: number; total: number } {
  const total = snapshot.rows.length;
  const submitted = snapshot.rows.filter(
    (row) => row.status === "success",
  ).length;
  return { submitted, total };
}

export function createEmptySitemapStatusSnapshot(
  siteUrl: string,
  entityPageCounts: SeoEntityPageCounts,
): SeoSitemapStatusSnapshot {
  return buildEntitySitemapStatuses({
    siteUrl,
    gscRows: [],
    entityPageCounts,
    fetchedAt: null,
  });
}

export function formatSitemapKpiValue(snapshot: SeoSitemapStatusSnapshot): string {
  const { submitted, total } = countSubmittedSitemaps(snapshot);
  if (snapshot.fetchError && submitted === 0) return "—";
  return `送信済 ${submitted}/${total}`;
}
