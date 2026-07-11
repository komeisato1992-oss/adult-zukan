import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { runSitemapSubmitAllAction } from "@/lib/admin/sitemap-admin-service";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSitemapSubmitAllAction();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Googleへの再送信に失敗しました。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
