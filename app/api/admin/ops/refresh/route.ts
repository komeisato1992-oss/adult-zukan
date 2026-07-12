import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { refreshOpsDashboardData } from "@/lib/admin/ops-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await refreshOpsDashboardData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "運営ダッシュボードの更新に失敗しました。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
