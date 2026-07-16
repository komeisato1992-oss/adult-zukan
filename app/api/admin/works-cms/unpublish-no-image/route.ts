import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { unpublishWorksWithoutPackageImage } from "@/lib/admin/unpublish-no-image-works";
import { invalidateWorksCmsOverviewCache } from "@/lib/admin/works-cms-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 画像なし作品を一括非公開（Git/JSON/デプロイなし） */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await unpublishWorksWithoutPackageImage();
    invalidateWorksCmsOverviewCache();
    return NextResponse.json({
      success: true,
      ...result,
      message: `画像なし ${result.noImageCount}件を確認し、${result.unpublishedCount}件を非公開化しました（デプロイなし）`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[works-cms/unpublish-no-image] failed", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
