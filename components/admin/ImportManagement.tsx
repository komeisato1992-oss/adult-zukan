import { ImportManagementClient } from "@/components/admin/ImportManagementClient";
import { FanzaSyncPanel } from "@/components/admin/FanzaSyncPanel";
import {
  isGitHubCatalogConfigured,
  logGitHubEnvDiagnostics,
} from "@/lib/admin/github-config";
import { isDmmConfigured } from "@/lib/dmm/client";

export async function ImportManagement() {
  logGitHubEnvDiagnostics();
  const configured = isGitHubCatalogConfigured();
  const dmmConfigured = isDmmConfigured();

  return (
    <>
      <FanzaSyncPanel configured={configured} dmmConfigured={dmmConfigured} />
      <ImportManagementClient
        configured={configured}
        dmmConfigured={dmmConfigured}
      />
    </>
  );
}
