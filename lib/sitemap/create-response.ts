import { getSitemapUrls } from "@/lib/sitemap/build-entries";
import { serializeSitemapToXml } from "@/lib/sitemap/serialize";

export const revalidate = 3600;

export async function createSitemapResponse(): Promise<Response> {
  const urls = await getSitemapUrls();
  const xml = serializeSitemapToXml(urls);

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
