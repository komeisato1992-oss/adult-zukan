import { NextResponse } from "next/server";
import { refreshSeoDashboardData } from "@/lib/admin/seo-service";

export const dynamic = "force-dynamic";

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
    const data = await refreshSeoDashboardData();
    return NextResponse.json({
      success: true,
      updatedAt: data.updatedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SEO cron refresh failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
