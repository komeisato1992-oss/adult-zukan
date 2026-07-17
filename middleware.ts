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

function normalizeWorkCid(raw: string): string {
  try {
    return decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

/**
 * works テーブルに cid が存在するか（Edge 互換の REST 呼び出し）。
 * 設定不足・障害時は null（ページ側判定に委譲）。
 */
async function worksCidExists(cid: string): Promise<boolean | null> {
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!base || !key || !cid) return null;

  try {
    const endpoint = new URL(`${base.replace(/\/$/, "")}/rest/v1/works`);
    endpoint.searchParams.set("cid", `eq.${cid}`);
    endpoint.searchParams.set("select", "cid");
    endpoint.searchParams.set("limit", "1");

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return null;
  }
}

/**
 * DB に存在しない /works/[cid] はストリーミング前に HTTP 404 を返す。
 * （App Router の loading/metadata ストリーミングだと notFound() が 200 になるため）
 */
async function maybeMissingWorkNotFound(
  request: NextRequest,
): Promise<NextResponse | null> {
  const match = request.nextUrl.pathname.match(/^\/works\/([^/]+)\/?$/);
  if (!match) return null;

  const cid = normalizeWorkCid(match[1] ?? "");
  if (!cid) return null;

  const exists = await worksCidExists(cid);
  if (exists !== false) return null;

  // 存在しないパスへ rewrite しつつ status 404（root not-found.tsx を表示）
  return NextResponse.rewrite(new URL("/__missing_work__", request.url), {
    status: 404,
  });
}

export async function middleware(request: NextRequest) {
  const missingWork = await maybeMissingWorkNotFound(request);
  if (missingWork) return missingWork;

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

  const shouldRedirect = LEGACY_SITE_HOSTS.some(
    (legacyHost) => legacyHost === host,
  );
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
