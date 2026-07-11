import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { toSeoCacheStoreErrorMessage } from "@/lib/admin/seo-cache-store";
import { refreshSeoSitemapsOnly } from "@/lib/admin/seo-service";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await refreshSeoSitemapsOnly();
    const hasError = Boolean(data.sitemapStatus.fetchError);
    return NextResponse.json({
      success: !hasError,
      data,
      message: hasError
        ? data.sitemapStatus.fetchError
        : "サイトマップ情報を再取得しました。",
    });
  } catch (error) {
    const { message, status } = toSeoCacheStoreErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
