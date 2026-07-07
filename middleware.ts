import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getCanonicalHostname,
  getSiteUrl,
  isLocalDevHost,
  LEGACY_SITE_HOSTS,
} from "@/lib/constants";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";

  if (!host || isLocalDevHost(host)) {
    return NextResponse.next();
  }

  const canonicalHost = getCanonicalHostname();
  if (host === canonicalHost) {
    return NextResponse.next();
  }

  const shouldRedirect = LEGACY_SITE_HOSTS.some((legacyHost) => legacyHost === host);
  if (!shouldRedirect) {
    return NextResponse.next();
  }

  const destination = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    getSiteUrl(),
  );

  return NextResponse.redirect(destination, 301);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-touch-icon.png).*)",
  ],
};
