import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { buildSearchConsoleStatusPayload } from "@/lib/admin/google-env-status";

export const dynamic = "force-dynamic";

/**
 * Search Console 連携の設定状態。
 * 読む環境変数: GOOGLE_SERVICE_ACCOUNT_JSON（およびフォールバック）と GSC_SITE_URL
 * レスポンスの env は値を含めず 存在する/存在しない のみ。
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(buildSearchConsoleStatusPayload());
}
