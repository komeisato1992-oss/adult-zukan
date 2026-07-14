import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { consumeAdminRateLimit } from "@/lib/admin/rate-limit";
import {
  requestStopDoujinFetch,
  runDoujinFetch,
} from "@/lib/doujin/fetch-service";
import {
  loadDoujinFetchJob,
  loadDoujinFetchLogs,
} from "@/lib/doujin/storage";
import { getDoujinCatalogStats } from "@/lib/doujin/upsert";
import {
  DoujinLocalWriteDisabledError,
  doujinWriteDisabledJsonBody,
  isDoujinLocalWriteAllowed,
} from "@/lib/doujin/write-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    job: loadDoujinFetchJob(),
    logs: loadDoujinFetchLogs().slice(0, 50),
    stats: getDoujinCatalogStats(),
    writeAllowed: isDoujinLocalWriteAllowed(),
  });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = consumeAdminRateLimit("admin-doujin-fetch", 10);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSec: rate.retryAfterSec },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as {
      action?: "start" | "stop";
      hits?: number;
      offset?: number;
      keyword?: string;
      contentId?: string;
      sort?: string;
      site?: string;
      service?: string;
      floor?: string;
      dryRun?: boolean;
    };

    if (body.action === "stop") {
      if (!isDoujinLocalWriteAllowed()) {
        return NextResponse.json(doujinWriteDisabledJsonBody(), { status: 403 });
      }
      const job = requestStopDoujinFetch();
      return NextResponse.json({ ok: true, job });
    }

    const dryRun = Boolean(body.dryRun);
    if (!dryRun && !isDoujinLocalWriteAllowed()) {
      return NextResponse.json(doujinWriteDisabledJsonBody(), { status: 403 });
    }

    const summary = await runDoujinFetch({
      hits: body.hits ?? 20,
      offset: body.offset,
      keyword: body.keyword,
      contentId: body.contentId,
      sort: body.sort,
      site: body.site,
      service: body.service,
      floor: body.floor,
      dryRun,
    });

    // 公開APIでは raw を返さない
    const { normalizedPreview, ...rest } = summary;
    return NextResponse.json({
      ...rest,
      dryRun,
      previewTitles: (normalizedPreview ?? []).map((item) => ({
        contentId: item.contentId,
        title: item.title,
        circleNames: item.circles.map((c) => c.name),
        authorNames: item.authors.map((a) => a.name),
      })),
      stats: getDoujinCatalogStats(),
    });
  } catch (error) {
    if (error instanceof DoujinLocalWriteDisabledError) {
      return NextResponse.json(doujinWriteDisabledJsonBody(), { status: 403 });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Fetch failed",
      },
      { status: 400 },
    );
  }
}
