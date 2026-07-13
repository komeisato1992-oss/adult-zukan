import { createSitemapIndexResponse } from "@/lib/sitemap/create-response";

export const revalidate = 86400;

export async function GET() {
  return createSitemapIndexResponse();
}
