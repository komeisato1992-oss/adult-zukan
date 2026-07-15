import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getAdminOpsSettingsView,
  writeAdminOpsSettings,
} from "@/lib/admin/admin-ops-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    ...getAdminOpsSettingsView(),
  });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      lightSyncEnabled?: boolean;
      fullSyncEnabled?: boolean;
    };

    const patch: {
      lightSyncEnabled?: boolean;
      fullSyncEnabled?: boolean;
    } = {};

    if (typeof body.lightSyncEnabled === "boolean") {
      patch.lightSyncEnabled = body.lightSyncEnabled;
    }
    if (typeof body.fullSyncEnabled === "boolean") {
      patch.fullSyncEnabled = body.fullSyncEnabled;
    }

    writeAdminOpsSettings(patch);
    return NextResponse.json({
      success: true,
      ...getAdminOpsSettingsView(),
    });
  } catch (error) {
    console.error("[ops-settings] failed", error);
    return NextResponse.json(
      { success: false, message: "設定の保存に失敗しました。" },
      { status: 500 },
    );
  }
}
