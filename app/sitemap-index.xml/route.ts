import { getSitemapEntries } from "@/lib/sitemap/build-entries";
import { serializeSitemapToXml } from "@/lib/sitemap/serialize";

export const revalidate = 3600;

export async function GET() {
  const entries = await getSitemapEntries();
  const xml = serializeSitemapToXml(entries);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
