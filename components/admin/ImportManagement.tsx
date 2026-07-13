import { ImportManagementClient } from "@/components/admin/ImportManagementClient";
import { FanzaSyncPanel } from "@/components/admin/FanzaSyncPanel";
import { CatalogPromotePanel } from "@/components/admin/CatalogPromotePanel";
import {
  isGitHubCatalogConfigured,
  logGitHubEnvDiagnostics,
} from "@/lib/admin/github-config";
import { isDmmConfigured } from "@/lib/dmm/client";
import { isAdultLocalWriteAllowed } from "@/lib/dmm/write-guard";

export async function ImportManagement() {
  logGitHubEnvDiagnostics();
  const githubConfigured = isGitHubCatalogConfigured();
  const localWrite = isAdultLocalWriteAllowed();
  const configured = githubConfigured || localWrite;
  const dmmConfigured = isDmmConfigured();

  return (
    <>
      <CatalogPromotePanel configured={githubConfigured} />
      <FanzaSyncPanel configured={configured} dmmConfigured={dmmConfigured} />
      <ImportManagementClient
        configured={configured}
        dmmConfigured={dmmConfigured}
        githubConfigured={githubConfigured}
      />
    </>
  );
}
