import { NextResponse } from "next/server";
import { refreshOpsDashboardData } from "@/lib/admin/ops-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await refreshOpsDashboardData();
    return NextResponse.json({
      success: true,
      generatedAt: data.generatedAt,
      updatedAt: data.top.updatedAt,
      seoScore: data.seoScore.total,
      alertCount: data.alerts.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ops cron refresh failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
