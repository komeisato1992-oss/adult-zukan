import { normalizeSiteUrl, SITE_URL } from "@/lib/constants";

/** Google 推奨を下回る安全な1ファイル上限 */
export const SITEMAP_WORKS_CHUNK_SIZE = 10_000;

export type SitemapDefinitionKey =
  | "index"
  | "static"
  | "works"
  | "actresses"
  | "makers"
  | "labels"
  | "series"
  | "genres";

export type SitemapDefinitionKind = "index" | "urlset";

export type SitemapDefinition = {
  key: string;
  entityKey: SitemapDefinitionKey | "works-chunk";
  label: string;
  pathname: string;
  url: string;
  kind: SitemapDefinitionKind;
  /** Search Console submit 対象か */
  submittable: boolean;
};

function buildAbsoluteUrl(pathname: string, siteUrl = SITE_URL): string {
  const base = normalizeSiteUrl(siteUrl.replace(/\/$/, ""));
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

export function getWorksChunkPathnames(workCount: number): string[] {
  if (workCount <= 0) {
    return ["/sitemaps/works.xml"];
  }

  const chunkCount = Math.ceil(workCount / SITEMAP_WORKS_CHUNK_SIZE);
  if (chunkCount <= 1) {
    return ["/sitemaps/works.xml"];
  }

  return Array.from(
    { length: chunkCount },
    (_, index) => `/sitemaps/works-${index + 1}.xml`,
  );
}

export function buildSitemapDefinitions(options?: {
  siteUrl?: string;
  worksCount?: number;
}): SitemapDefinition[] {
  const siteUrl = options?.siteUrl ?? SITE_URL;
  const worksPathnames = getWorksChunkPathnames(options?.worksCount ?? 0);

  const definitions: SitemapDefinition[] = [
    {
      key: "index",
      entityKey: "index",
      label: "サイトマップインデックス",
      pathname: "/sitemap.xml",
      url: buildAbsoluteUrl("/sitemap.xml", siteUrl),
      kind: "index",
      submittable: true,
    },
    {
      key: "static",
      entityKey: "static",
      label: "静的ページ",
      pathname: "/sitemaps/static.xml",
      url: buildAbsoluteUrl("/sitemaps/static.xml", siteUrl),
      kind: "urlset",
      submittable: false,
    },
    ...worksPathnames.map((pathname, index) => ({
      key:
        worksPathnames.length > 1
          ? `works-${index + 1}`
          : "works",
      entityKey: "works" as const,
      label:
        worksPathnames.length > 1
          ? `作品 (${index + 1}/${worksPathnames.length})`
          : "作品",
      pathname,
      url: buildAbsoluteUrl(pathname, siteUrl),
      kind: "urlset" as const,
      submittable: false,
    })),
    {
      key: "actresses",
      entityKey: "actresses",
      label: "女優",
      pathname: "/sitemaps/actresses.xml",
      url: buildAbsoluteUrl("/sitemaps/actresses.xml", siteUrl),
      kind: "urlset",
      submittable: false,
    },
    {
      key: "makers",
      entityKey: "makers",
      label: "メーカー",
      pathname: "/sitemaps/makers.xml",
      url: buildAbsoluteUrl("/sitemaps/makers.xml", siteUrl),
      kind: "urlset",
      submittable: false,
    },
    {
      key: "labels",
      entityKey: "labels",
      label: "レーベル",
      pathname: "/sitemaps/labels.xml",
      url: buildAbsoluteUrl("/sitemaps/labels.xml", siteUrl),
      kind: "urlset",
      submittable: false,
    },
    {
      key: "series",
      entityKey: "series",
      label: "シリーズ",
      pathname: "/sitemaps/series.xml",
      url: buildAbsoluteUrl("/sitemaps/series.xml", siteUrl),
      kind: "urlset",
      submittable: false,
    },
    {
      key: "genres",
      entityKey: "genres",
      label: "ジャンル",
      pathname: "/sitemaps/genres.xml",
      url: buildAbsoluteUrl("/sitemaps/genres.xml", siteUrl),
      kind: "urlset",
      submittable: false,
    },
  ];

  return definitions;
}

export function findSitemapDefinitionByKey(
  key: string,
  worksCount?: number,
): SitemapDefinition | null {
  return (
    buildSitemapDefinitions({ worksCount }).find(
      (definition) => definition.key === key,
    ) ?? null
  );
}

export function findSitemapDefinitionByPathname(
  pathname: string,
  worksCount?: number,
): SitemapDefinition | null {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return (
    buildSitemapDefinitions({ worksCount }).find(
      (definition) => definition.pathname === normalized,
    ) ?? null
  );
}

export function parseSitemapFilename(filename: string): string | null {
  const trimmed = filename.trim();
  if (!trimmed.endsWith(".xml")) return null;
  return trimmed;
}
