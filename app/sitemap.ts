import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/sitemap/build-entries";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getSitemapEntries();
}
