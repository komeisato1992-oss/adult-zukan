import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import type { ImportCandidateSortKey } from "@/lib/admin/import-candidate-types";
import { getImportCandidatesList } from "@/lib/admin/import-candidates-query";
import type { ImportFilterKey } from "@/lib/admin/import-quality";
import { isDmmConfigured } from "@/lib/dmm/client";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";

const VALID_SORTS = new Set<ImportCandidateSortKey>([
  "collectedAt-desc",
  "releaseDate-desc",
  "price-desc",
  "actress-first",
  "image-first",
  "random",
]);

const VALID_FILTERS = new Set<ImportFilterKey>([
  "hasImage",
  "hasActress",
  "hasPrice",
  "hasDescription",
  "hasSampleImages",
  "isSoloWork",
  "isOnSale",
]);

function parseSort(value: string | null): ImportCandidateSortKey {
  if (value && VALID_SORTS.has(value as ImportCandidateSortKey)) {
    return value as ImportCandidateSortKey;
  }
  return "collectedAt-desc";
}

function parseFilters(value: string | null): ImportFilterKey[] {
  if (!value?.trim()) return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is ImportFilterKey =>
      VALID_FILTERS.has(entry as ImportFilterKey),
    );
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const sort = parseSort(searchParams.get("sort"));
  const filters = parseFilters(searchParams.get("filters"));

  try {
    const result = await getImportCandidatesList({
      page: Number.isFinite(page) ? page : 1,
      sort,
      filters,
    });

    return NextResponse.json({
      ...result,
      configured: isGitHubCatalogConfigured(),
      dmmConfigured: isDmmConfigured(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "候補一覧の取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}
