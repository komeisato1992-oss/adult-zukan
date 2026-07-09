import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getCanonicalHostname,
  getSiteUrl,
  isLocalDevHost,
  isWwwVariantHost,
  LEGACY_SITE_HOSTS,
} from "@/lib/constants";

function buildCanonicalRedirectUrl(request: NextRequest): URL {
  return new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    getSiteUrl(),
  );
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";

  if (!host || isLocalDevHost(host)) {
    return NextResponse.next();
  }

  const canonicalHost = getCanonicalHostname();

  if (host === canonicalHost) {
    return NextResponse.next();
  }

  if (isWwwVariantHost(host, canonicalHost)) {
    return NextResponse.redirect(buildCanonicalRedirectUrl(request), 301);
  }

  const shouldRedirect = LEGACY_SITE_HOSTS.some((legacyHost) => legacyHost === host);
  if (shouldRedirect) {
    return NextResponse.redirect(buildCanonicalRedirectUrl(request), 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-touch-icon.png).*)",
  ],
};
