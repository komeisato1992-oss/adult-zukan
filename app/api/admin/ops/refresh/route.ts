import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { refreshOpsSource } from "@/lib/admin/ops-service";
import type { OpsRefreshSource } from "@/lib/admin/ops-types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseSource(value: unknown): OpsRefreshSource {
  if (
    value === "seo" ||
    value === "ga4" ||
    value === "dmm" ||
    value === "score" ||
    value === "all"
  ) {
    return value;
  }
  return "all";
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let source: OpsRefreshSource = "all";
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as {
        source?: unknown;
      } | null;
      source = parseSource(body?.source);
    } else {
      const url = new URL(request.url);
      source = parseSource(url.searchParams.get("source"));
    }

    const data = await refreshOpsSource(source);
    return NextResponse.json(
      { success: true, source, data },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "運営ダッシュボードの更新に失敗しました。";
    return NextResponse.json(
      { success: false, error: message },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}
