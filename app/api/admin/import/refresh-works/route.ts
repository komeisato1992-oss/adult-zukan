import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  parseRefreshCatalogWorksRequest,
  refreshCatalogWorks,
  RefreshCatalogWorksError,
} from "@/lib/admin/refresh-catalog-works";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const startedAt = Date.now();

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = parseRefreshCatalogWorksRequest(body);
    const result = await refreshCatalogWorks(input);

    return NextResponse.json({
      success: true,
      ...result,
      debug: {
        elapsedMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    console.error("[refresh-works] failed", error);

    if (error instanceof RefreshCatalogWorksError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          error: error.message,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "掲載済み作品の更新に失敗しました。",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
