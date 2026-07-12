import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getPopularActresses,
  getPopularMakers,
  getPopularSeries,
  refreshEntityRankingCache,
} from "@/lib/ranking/entity-ranking-service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [actresses, makers, series] = await Promise.all([
    getPopularActresses(10),
    getPopularMakers(10),
    getPopularSeries(10),
  ]);

  return NextResponse.json({
    success: true,
    actresses,
    makers,
    series,
  });
}

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await refreshEntityRankingCache();
    return NextResponse.json({
      success: true,
      updatedAt: payload.updatedAt,
      counts: {
        actresses: payload.actresses.length,
        makers: payload.makers.length,
        series: payload.series.length,
      },
      top: {
        actresses: payload.actresses.slice(0, 10).map((row) => ({
          name: row.name,
          workCount: row.workCount,
          score: row.score,
          breakdown: row.breakdown,
        })),
        makers: payload.makers.slice(0, 10).map((row) => ({
          name: row.name,
          workCount: row.workCount,
          score: row.score,
          breakdown: row.breakdown,
        })),
        series: payload.series.slice(0, 10).map((row) => ({
          name: row.name,
          workCount: row.workCount,
          score: row.score,
          breakdown: row.breakdown,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "再集計に失敗しました。",
      },
      { status: 500 },
    );
  }
}
