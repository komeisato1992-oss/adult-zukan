import { NextResponse } from "next/server";
import { getRandomComparisonPair } from "@/lib/compare/random-pair";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ランダム比較ペア生成（インデックス非対象） */
export async function GET() {
  try {
    const pair = await getRandomComparisonPair();
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
