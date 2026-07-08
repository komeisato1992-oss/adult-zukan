import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getImportCandidatesList } from "@/lib/admin/import-candidates-query";
import { isDmmConfigured } from "@/lib/dmm/client";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";

/** @deprecated /api/admin/import/get-candidates を使用してください */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getImportCandidatesList({ page: 1 });

  return NextResponse.json({
    newWorks: [],
    randomWorks: result.candidates.map((candidate) => ({
      source: candidate.source,
      sourceLabel: candidate.source,
      item: candidate.item,
    })),
    totalCount: result.pagination.totalCount,
    configured: isGitHubCatalogConfigured() && isDmmConfigured(),
    message:
      "この API は非推奨です。/api/admin/import/get-candidates を使用してください。",
  });
}
