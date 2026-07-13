import { NextResponse } from "next/server";
import {
  refreshOpsGa4Source,
  refreshOpsSeoSource,
} from "@/lib/admin/ops-service";

export const dynamic = "force-dynamic";
/** SEO / GA4 を交互に短いジョブとして実行 */
export const maxDuration = 60;

/**
 * ?source=seo|ga4 で分割実行。
 * 未指定時は UTC 時間帯で振り分け（08時台=GA4、それ以外=SEO）。
 */
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

  const url = new URL(request.url);
  const sourceParam = url.searchParams.get("source");
  const hour = new Date().getUTCHours();
  const source =
    sourceParam === "seo" || sourceParam === "ga4"
      ? sourceParam
      : hour === 8
        ? "ga4"
        : "seo";

  try {
    const data =
      source === "ga4"
        ? await refreshOpsGa4Source()
        : await refreshOpsSeoSource();
    return NextResponse.json({
      success: true,
      source,
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
