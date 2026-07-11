import { ImportManagementClient } from "@/components/admin/ImportManagementClient";
import {
  isGitHubCatalogConfigured,
  logGitHubEnvDiagnostics,
} from "@/lib/admin/github-config";
import { isDmmConfigured } from "@/lib/dmm/client";

export async function ImportManagement() {
  logGitHubEnvDiagnostics();

  return (
    <ImportManagementClient
      configured={isGitHubCatalogConfigured()}
      dmmConfigured={isDmmConfigured()}
    />
  );
}
