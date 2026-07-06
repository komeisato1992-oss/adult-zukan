import type { MetadataRoute } from "next";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatLastModified(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function serializeSitemapToXml(
  entries: MetadataRoute.Sitemap,
): string {
  const urls = entries
    .map((item) => {
      const lastModified = formatLastModified(item.lastModified);
      const changeFrequency = item.changeFrequency
        ? `<changefreq>${escapeXml(item.changeFrequency)}</changefreq>`
        : "";
      const priority =
        item.priority !== undefined
          ? `<priority>${item.priority}</priority>`
          : "";
      const lastmod = lastModified ? `<lastmod>${lastModified}</lastmod>` : "";

      return `<url>
<loc>${escapeXml(item.url)}</loc>
${lastmod}
${changeFrequency}
${priority}
</url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
