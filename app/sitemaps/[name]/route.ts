import { createChildSitemapResponse } from "@/lib/sitemap/create-response";

export const revalidate = 86400;

type RouteContext = {
  params: Promise<{ name: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { name } = await context.params;
  return createChildSitemapResponse(name);
}
