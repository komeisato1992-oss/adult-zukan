import { createSitemapIndexResponse } from "@/lib/sitemap/create-response";

export const revalidate = 3600;

export async function GET() {
  return createSitemapIndexResponse();
}
