import { siteConfig } from "@/lib/site-config";
import { getLatestWorks } from "@/lib/works/repository";

export async function GET() {
  const works = await getLatestWorks(30);
  const now = new Date().toUTCString();

  const items = works
    .map(
      (work) => `    <item>
      <title><![CDATA[${work.title}]]></title>
      <link>${siteConfig.url}/works/${work.slug}</link>
      <guid isPermaLink="true">${siteConfig.url}/works/${work.slug}</guid>
      <pubDate>${new Date(work.releaseDate).toUTCString()}</pubDate>
      <description><![CDATA[${work.description}]]></description>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${siteConfig.name} - 新着作品</title>
    <link>${siteConfig.url}</link>
    <description>${siteConfig.description}</description>
    <language>ja</language>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
