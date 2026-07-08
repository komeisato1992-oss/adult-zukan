import { ImportManagementClient } from "@/components/admin/ImportManagementClient";
import { getImportCandidates } from "@/lib/admin/import-candidates";

export async function ImportManagement() {
  let initialData;

  try {
    initialData = await getImportCandidates();
  } catch (error) {
    initialData = {
      newWorks: [],
      randomWorks: [],
      totalCount: 0,
      configured: true,
      message:
        error instanceof Error
          ? error.message
          : "候補作品の取得に失敗しました。",
    };
  }

  return <ImportManagementClient initialData={initialData} />;
}
