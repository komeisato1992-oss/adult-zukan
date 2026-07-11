import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { runSitemapRefreshAction } from "@/lib/admin/sitemap-admin-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { key?: string };
  if (!body.key?.trim()) {
    return NextResponse.json(
      { error: "key が必要です。" },
      { status: 400 },
    );
  }

  try {
    const result = await runSitemapRefreshAction(body.key.trim());
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "サイトマップ更新に失敗しました。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
