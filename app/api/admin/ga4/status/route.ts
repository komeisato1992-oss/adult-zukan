import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { buildGa4StatusPayload } from "@/lib/admin/google-env-status";

export const dynamic = "force-dynamic";

/**
 * GA4 Data API 連携の設定状態。
 * 読む環境変数: GOOGLE_SERVICE_ACCOUNT_JSON（およびフォールバック）と
 * GA4_PROPERTY_ID / GOOGLE_ANALYTICS_PROPERTY_ID
 * レスポンスの env は値を含めず 存在する/存在しない のみ。
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(buildGa4StatusPayload());
}
