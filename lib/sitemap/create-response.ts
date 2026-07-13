import {
  getSitemapEntriesForFilename,
  getSitemapIndexEntries,
} from "@/lib/sitemap/build-entries";
import {
  serializeSitemapIndexToXml,
  serializeSitemapToXml,
} from "@/lib/sitemap/serialize";

export const revalidate = 86400;

const XML_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
} as const;

export async function createSitemapIndexResponse(): Promise<Response> {
  const entries = await getSitemapIndexEntries();
  const xml = serializeSitemapIndexToXml(entries);

  return new Response(xml, {
    status: 200,
    headers: XML_HEADERS,
  });
}

export async function createChildSitemapResponse(
  filename: string,
): Promise<Response> {
  const entries = await getSitemapEntriesForFilename(filename);
  if (entries.length === 0) {
    return new Response("Not Found", { status: 404 });
  }

  const xml = serializeSitemapToXml(entries);
  return new Response(xml, {
    status: 200,
    headers: XML_HEADERS,
  });
}

/** @deprecated 分割サイトマップ移行後は createSitemapIndexResponse を使用 */
export async function createSitemapResponse(): Promise<Response> {
  return createSitemapIndexResponse();
}
