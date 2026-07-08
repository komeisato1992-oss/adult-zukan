import { ImportManagementClient } from "@/components/admin/ImportManagementClient";
import { getImportCandidatesList } from "@/lib/admin/import-candidates-query";
import {
  isGitHubCatalogConfigured,
  logGitHubEnvDiagnostics,
} from "@/lib/admin/github-config";
import { isImportCandidatesJsonCorruptError } from "@/lib/admin/import-candidates-json";
import { isDmmConfigured } from "@/lib/dmm/client";

export async function ImportManagement() {
  logGitHubEnvDiagnostics();

  let initialData;

  try {
    const list = await getImportCandidatesList({});
    initialData = {
      ...list,
      configured: isGitHubCatalogConfigured(),
      dmmConfigured: isDmmConfigured(),
      jsonCorrupt: false,
    };
  } catch (error) {
    initialData = {
      summary: {
        publishedCount: 0,
        catalogTotalCount: 0,
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
      jsonCorrupt: isImportCandidatesJsonCorruptError(error),
      message:
        error instanceof Error
          ? error.message
          : "候補一覧の取得に失敗しました。",
    };
  }

  return <ImportManagementClient initialData={initialData} />;
}
