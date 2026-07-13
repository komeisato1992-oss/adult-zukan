import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { canAccessDoujinSite } from "@/lib/doujin/access";
import { getDoujinRandomComparisonPair } from "@/lib/doujin/compare/random-pair";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 同人ランダム比較ペア生成（インデックス非対象） */
export async function GET() {
  const isAdmin = await isAdminAuthenticated();
  if (!canAccessDoujinSite({ isAdmin })) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const pair = await getDoujinRandomComparisonPair();
    if (!pair) {
      return NextResponse.json(
        { error: "比較作品を取得できませんでした" },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        },
      );
    }

    return NextResponse.json(pair, {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "比較作品を取得できませんでした" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }
}
