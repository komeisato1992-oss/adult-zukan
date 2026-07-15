import { WorksOpsDashboard } from "@/components/admin/WorksOpsDashboard";
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
    <WorksOpsDashboard
      configured={configured}
      dmmConfigured={dmmConfigured}
      githubConfigured={githubConfigured}
    />
  );
}
