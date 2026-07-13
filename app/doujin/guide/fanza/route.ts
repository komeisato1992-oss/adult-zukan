import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { canAccessDoujinSite } from "@/lib/doujin/access";
import {
  buildDoujinAffiliateUrl,
  isValidDoujinAffiliateUrl,
} from "@/lib/doujin/affiliate";
import { getDoujinWorkById } from "@/lib/doujin/catalog";
import { isDoujinFirstTimeGuideEnabled } from "@/lib/doujin/first-time-guide";

export const runtime = "nodejs";

/**
 * workId からアフィリエイトURLへ 302 リダイレクト。
 * affiliateURL をクエリに載せない。
 */
export async function GET(request: Request) {
  if (!isDoujinFirstTimeGuideEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const isAdmin = await isAdminAuthenticated();
  if (!canAccessDoujinSite({ isAdmin })) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const workId = searchParams.get("workId")?.trim();
  if (!workId) {
    return NextResponse.redirect(new URL("/doujin/works", request.url), 302);
  }

  const work = getDoujinWorkById(workId);
  if (!work) {
    return NextResponse.redirect(new URL("/doujin/works", request.url), 302);
  }

  const affiliateUrl = buildDoujinAffiliateUrl(work);
  if (!isValidDoujinAffiliateUrl(affiliateUrl)) {
    return NextResponse.redirect(
      new URL(`/doujin/works/${work.id}`, request.url),
      302,
    );
  }

  return NextResponse.redirect(affiliateUrl, 302);
}
