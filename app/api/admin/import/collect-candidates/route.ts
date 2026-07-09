import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { collectImportCandidates } from "@/lib/admin/import-collect";
import { isDmmConfigured } from "@/lib/dmm/client";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await collectImportCandidates();

    if (!result.configured) {
      return NextResponse.json(
        { error: result.message, configured: false },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      candidates: result.candidates,
      summary: result.summary,
      pagination: result.pagination,
      collectedCount: result.collectedCount,
      displayedCount: result.displayedCount,
      message: result.message,
      configured: isGitHubCatalogConfigured(),
      dmmConfigured: isDmmConfigured(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "候補の収集に失敗しました。",
      },
      { status: 500 },
    );
  }
}
