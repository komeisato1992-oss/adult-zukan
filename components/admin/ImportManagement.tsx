import { ImportManagementClient } from "@/components/admin/ImportManagementClient";
import { getImportCandidatesList } from "@/lib/admin/import-candidates-query";
import { isGitHubCatalogConfigured } from "@/lib/admin/github-config";
import { isDmmConfigured } from "@/lib/dmm/client";

export async function ImportManagement() {
  let initialData;

  try {
    const list = await getImportCandidatesList({});
    initialData = {
      ...list,
      configured: isGitHubCatalogConfigured(),
      dmmConfigured: isDmmConfigured(),
    };
  } catch (error) {
    initialData = {
      summary: {
        publishedCount: 0,
        candidateCount: 0,
        addedCount: 0,
        excludedCount: 0,
        lastCollectedAt: null,
      },
      candidates: [],
      pagination: {
        page: 1,
        pageSize: 100,
        totalPages: 1,
        totalCount: 0,
      },
      configured: isGitHubCatalogConfigured(),
      dmmConfigured: isDmmConfigured(),
      message:
        error instanceof Error
          ? error.message
          : "候補一覧の取得に失敗しました。",
    };
  }

  return <ImportManagementClient initialData={initialData} />;
}
