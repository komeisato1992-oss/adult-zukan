import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  collectImportCandidates,
  isImportCollectInProgress,
} from "@/lib/admin/import-collect";
import type { ImportCollectionMode } from "@/lib/admin/import-collect-types";
import { isDmmConfigured } from "@/lib/dmm/client";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";

export const dynamic = "force-dynamic";

function parseMode(value: unknown): ImportCollectionMode {
  return value === "past" ? "past" : "new";
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isImportCollectInProgress()) {
    return NextResponse.json(
      { error: "候補収集が既に実行中です。完了までお待ちください。" },
      { status: 409 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: string;
    };
    const mode = parseMode(body.mode);
    const result = await collectImportCandidates(mode);

    if (!result.configured) {
      return NextResponse.json(
        { error: result.message, configured: false },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      mode,
      count: result.count,
      candidates: result.candidates,
      summary: result.summary,
      pagination: result.pagination,
      collectedCount: result.collectedCount,
      displayedCount: result.displayedCount,
      message: result.message,
      runStats: result.runStats,
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
