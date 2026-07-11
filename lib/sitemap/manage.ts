import "server-only";

import { revalidatePath } from "next/cache";
import { getSiteUrl, normalizeSiteUrl } from "@/lib/constants";
import {
  buildSitemapDefinitions,
  findSitemapDefinitionByKey,
  type SitemapDefinition,
} from "@/lib/sitemap/definitions";
import {
  countSitemapEntriesByKey,
  getSitemapEntriesForDefinition,
} from "@/lib/sitemap/build-entries";
import { getCatalogWorks } from "@/lib/catalog";
import {
  serializeSitemapIndexToXml,
  serializeSitemapToXml,
} from "@/lib/sitemap/serialize";
import { getSitemapIndexEntries } from "@/lib/sitemap/build-entries";

export type SitemapValidationResult = {
  ok: boolean;
  httpStatus: number;
  urlCount: number;
  duplicateCount: number;
  foreignUrlCount: number;
  emptyLocCount: number;
  rootElement: "urlset" | "sitemapindex" | "unknown" | "missing";
  contentType: string;
  errors: string[];
};

export type SitemapRefreshResult = {
  key: string;
  label: string;
  url: string;
  pathname: string;
  urlCount: number;
  previousUrlCount: number | null;
  addedCount: number | null;
  duplicateCount: number;
  httpStatus: number;
  generatedAt: string;
  validation: SitemapValidationResult;
};

type SitemapMetaStore = typeof globalThis & {
  __sitemapGenerationMeta?: Record<
    string,
    { urlCount: number; generatedAt: string }
  >;
};

function getMetaStore(): SitemapMetaStore {
  return globalThis as SitemapMetaStore;
}

function readPreviousMeta(key: string): { urlCount: number; generatedAt: string } | null {
  return getMetaStore().__sitemapGenerationMeta?.[key] ?? null;
}

function writeMeta(key: string, urlCount: number, generatedAt: string): void {
  const store = getMetaStore();
  store.__sitemapGenerationMeta = {
    ...(store.__sitemapGenerationMeta ?? {}),
    [key]: { urlCount, generatedAt },
  };
}

export function getSitemapGenerationMeta(key: string): {
  urlCount: number;
  generatedAt: string;
} | null {
  return readPreviousMeta(key);
}

export async function listSitemapDefinitions(): Promise<SitemapDefinition[]> {
  const works = await getCatalogWorks();
  return buildSitemapDefinitions({
    siteUrl: getSiteUrl(),
    worksCount: works.length,
  });
}

export function revalidateSitemapPaths(pathnames: string[]): void {
  for (const pathname of pathnames) {
    revalidatePath(pathname);
  }
}

export async function revalidateAllSitemapPaths(): Promise<string[]> {
  const definitions = await listSitemapDefinitions();
  const pathnames = definitions.map((definition) => definition.pathname);
  revalidateSitemapPaths(pathnames);
  return pathnames;
}

export async function revalidateSitemapByKey(key: string): Promise<string[]> {
  const works = await getCatalogWorks();
  const definition = findSitemapDefinitionByKey(key, works.length);
  if (!definition) {
    throw new Error(`未知のサイトマップキーです: ${key}`);
  }

  if (key === "index") {
    const pathnames = (await listSitemapDefinitions()).map(
      (entry) => entry.pathname,
    );
    revalidateSitemapPaths(pathnames);
    return pathnames;
  }

  revalidateSitemapPaths([definition.pathname, "/sitemap.xml"]);
  return [definition.pathname, "/sitemap.xml"];
}

function parseRootElement(xml: string): SitemapValidationResult["rootElement"] {
  if (xml.includes("<sitemapindex")) return "sitemapindex";
  if (xml.includes("<urlset")) return "urlset";
  return "missing";
}

function extractLocValues(xml: string): string[] {
  const matches = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)];
  return matches.map((match) =>
    match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim(),
  );
}

function expectedRootForKind(
  kind: SitemapDefinition["kind"],
): "urlset" | "sitemapindex" {
  return kind === "index" ? "sitemapindex" : "urlset";
}

export function validateSitemapXml(
  xml: string,
  options?: { expectedRoot?: "urlset" | "sitemapindex" },
): SitemapValidationResult {
  const errors: string[] = [];
  const rootElement = parseRootElement(xml);

  if (rootElement === "missing") {
    errors.push("urlset または sitemapindex が見つかりません。");
  }

  if (options?.expectedRoot && rootElement !== options.expectedRoot) {
    errors.push(`期待するルート要素 ${options.expectedRoot} と一致しません。`);
  }

  const locValues = extractLocValues(xml);
  const emptyLocCount = locValues.filter((value) => value.length === 0).length;
  if (emptyLocCount > 0) {
    errors.push(`空の loc が ${emptyLocCount} 件あります。`);
  }

  const seen = new Set<string>();
  let duplicateCount = 0;
  for (const loc of locValues) {
    if (seen.has(loc)) duplicateCount += 1;
    seen.add(loc);
  }
  if (duplicateCount > 0) {
    errors.push(`重複URLが ${duplicateCount} 件あります。`);
  }

  const siteOrigin = normalizeSiteUrl(getSiteUrl());
  let foreignUrlCount = 0;
  for (const loc of locValues) {
    try {
      const origin = normalizeSiteUrl(new URL(loc).origin);
      if (origin !== siteOrigin) foreignUrlCount += 1;
    } catch {
      foreignUrlCount += 1;
    }
  }
  if (foreignUrlCount > 0) {
    errors.push(`外部ドメインURLが ${foreignUrlCount} 件含まれています。`);
  }

  return {
    ok: errors.length === 0,
    httpStatus: 200,
    urlCount: locValues.length,
    duplicateCount,
    foreignUrlCount,
    emptyLocCount,
    rootElement,
    contentType: "application/xml; charset=utf-8",
    errors,
  };
}

async function buildXmlForDefinition(
  definition: SitemapDefinition,
): Promise<string> {
  if (definition.kind === "index") {
    const entries = await getSitemapIndexEntries();
    return serializeSitemapIndexToXml(entries);
  }

  const entries = await getSitemapEntriesForDefinition(definition);
  return serializeSitemapToXml(entries);
}

export async function refreshSitemapByKey(key: string): Promise<SitemapRefreshResult> {
  const works = await getCatalogWorks();
  const definition = findSitemapDefinitionByKey(key, works.length);
  if (!definition) {
    throw new Error(`未知のサイトマップキーです: ${key}`);
  }

  await revalidateSitemapByKey(key);

  const xml = await buildXmlForDefinition(definition);
  const validation = validateSitemapXml(xml, {
    expectedRoot: expectedRootForKind(definition.kind),
  });
  const previous = readPreviousMeta(key);
  const generatedAt = new Date().toISOString();
  writeMeta(key, validation.urlCount, generatedAt);

  return {
    key: definition.key,
    label: definition.label,
    url: definition.url,
    pathname: definition.pathname,
    urlCount: validation.urlCount,
    previousUrlCount: previous?.urlCount ?? null,
    addedCount:
      previous?.urlCount != null
        ? validation.urlCount - previous.urlCount
        : null,
    duplicateCount: validation.duplicateCount,
    httpStatus: validation.ok ? 200 : 500,
    generatedAt,
    validation,
  };
}

export async function refreshAllSitemaps(): Promise<SitemapRefreshResult[]> {
  const definitions = await listSitemapDefinitions();
  const results: SitemapRefreshResult[] = [];

  for (const definition of definitions) {
    results.push(await refreshSitemapByKey(definition.key));
  }

  return results;
}

export async function previewSitemapValidationByKey(
  key: string,
): Promise<SitemapValidationResult> {
  const works = await getCatalogWorks();
  const definition = findSitemapDefinitionByKey(key, works.length);
  if (!definition) {
    throw new Error(`未知のサイトマップキーです: ${key}`);
  }

  const xml = await buildXmlForDefinition(definition);
  return validateSitemapXml(xml, {
    expectedRoot: expectedRootForKind(definition.kind),
  });
}

export async function getLocalSitemapUrlCount(key: string): Promise<number> {
  return countSitemapEntriesByKey(key);
}
