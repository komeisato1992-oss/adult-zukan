import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { checkImportCandidateImages } from "@/lib/admin/check-import-candidate-images";
import type { FetchedImportCandidate } from "@/lib/admin/import-simple-types";
import type { DmmItem } from "@/lib/dmm/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, error: "認証が必要です" },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      candidates?: unknown;
    } | null;

    if (!body || !Array.isArray(body.candidates)) {
      return NextResponse.json(
        { ok: false, error: "candidates が不正です" },
        { status: 400 },
      );
    }

    const input: FetchedImportCandidate[] = [];
    for (const entry of body.candidates) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as {
        contentId?: string;
        item?: DmmItem;
        productId?: string;
        rankPosition?: number | null;
        candidateMeta?: FetchedImportCandidate["candidateMeta"];
      };
      if (!row.contentId?.trim() || !row.item) continue;
      // fetch_failed のみ再確認（クライアント側でも絞るがサーバでも防御）
      input.push({
        contentId: row.contentId.trim(),
        productId: row.productId?.trim() || row.contentId.trim(),
        item: row.item,
        rankPosition: row.rankPosition ?? null,
        candidateMeta: row.candidateMeta ?? {
          sourceSort: "new",
          sourceOffset: 0,
          sourceIndex: 0,
          absolutePopularityPosition: 0,
        },
      });
    }

    if (input.length === 0) {
      return NextResponse.json({
        ok: true,
        candidates: [],
        stats: {
          total: 0,
          okCount: 0,
          nowPrintingCount: 0,
          fetchFailedCount: 0,
          noUrlCount: 0,
          imageGetCount: 0,
          checkedSuccessCount: 0,
          message: "再確認対象がありません。",
        },
      });
    }

    const result = await checkImportCandidateImages(input, { concurrency: 3 });
    return NextResponse.json({
      ok: true,
      candidates: result.candidates,
      stats: result.stats,
    });
  } catch (error) {
    console.error("[recheck-candidate-images] failed", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "画像の再確認に失敗しました",
      },
      { status: 500 },
    );
  }
}
