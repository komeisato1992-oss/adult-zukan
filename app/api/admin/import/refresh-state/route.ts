import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { loadCatalogRefreshState } from "@/lib/admin/github-catalog-refresh-state";
import {
  parseRefreshCatalogWorksRequest,
  refreshCatalogWorks,
  RefreshCatalogWorksError,
} from "@/lib/admin/refresh-catalog-works";
import { fetchCatalogFromGitHub } from "@/lib/admin/github-catalog";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const state = await loadCatalogRefreshState();
    let catalogCount = 0;

    if (isGitHubCatalogConfigured()) {
      try {
        const { items } = await fetchCatalogFromGitHub();
        catalogCount = items.length;
      } catch {
        const { readCatalogSnapshot } = await import("@/lib/dmm/catalog-snapshot");
        catalogCount = readCatalogSnapshot().length;
      }
    } else {
      const { readCatalogSnapshot } = await import("@/lib/dmm/catalog-snapshot");
      catalogCount = readCatalogSnapshot().length;
    }

    return NextResponse.json({
      catalogCount,
      state,
    });
  } catch (error) {
    console.error("[refresh-state] failed", error);
    return NextResponse.json(
      { error: "更新状態の取得に失敗しました。" },
      { status: 500 },
    );
  }
}
