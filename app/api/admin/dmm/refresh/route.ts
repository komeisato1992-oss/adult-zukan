import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getDmmAdminStatus,
  refreshDmmAffiliateData,
} from "@/lib/admin/dmm-affiliate-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await refreshDmmAffiliateData();
    const data = await getDmmAdminStatus();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "DMM成果データの更新に失敗しました。",
      },
      { status: 500 },
    );
  }
}
