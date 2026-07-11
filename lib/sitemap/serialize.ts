import type { SitemapEntry } from "@/lib/sitemap/types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function serializeSitemapToXml(entries: SitemapEntry[]): string {
  const body = entries
    .map(
      (entry) => `<url>
<loc>${escapeXml(entry.loc)}</loc>
<lastmod>${escapeXml(entry.lastmod)}</lastmod>
</url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function serializeSitemapIndexToXml(entries: SitemapEntry[]): string {
  const body = entries
    .map(
      (entry) => `<sitemap>
<loc>${escapeXml(entry.loc)}</loc>
<lastmod>${escapeXml(entry.lastmod)}</lastmod>
</sitemap>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>
`;
}
