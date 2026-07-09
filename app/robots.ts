import type { MetadataRoute } from "next";
import { getCanonicalHostname, SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/favorites", "/history", "/age-denied", "/admin", "/api/"],
      },
    ],
    host: getCanonicalHostname(),
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
