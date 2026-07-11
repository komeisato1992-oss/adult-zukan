import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { toSeoCacheStoreErrorMessage } from "@/lib/admin/seo-cache-store";
import { buildSeoEnvDiagnostics, logSeoEnvPresence } from "@/lib/admin/seo-env-diagnostics";
import { probeSearchConsoleConnection } from "@/lib/admin/google-search-console";
import { refreshSeoDashboardData } from "@/lib/admin/seo-service";
import { getSeoConfigStatus } from "@/lib/admin/seo-config";

export const dynamic = "force-dynamic";

async function buildDiagnosticsWithProbe() {
  const config = getSeoConfigStatus();
  if (!config.configured || !config.gscSiteUrl) {
    return buildSeoEnvDiagnostics({ connectionProbe: null });
  }

  try {
    const connectionProbe = await probeSearchConsoleConnection(config.gscSiteUrl);
    return buildSeoEnvDiagnostics({ connectionProbe });
  } catch {
    return buildSeoEnvDiagnostics({ connectionProbe: null });
  }
}

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logSeoEnvPresence();

  try {
    const data = await refreshSeoDashboardData();
    const envDiagnostics = await buildDiagnosticsWithProbe();
    return NextResponse.json({ success: true, data, envDiagnostics });
  } catch (error) {
    const {
      message,
      status,
      code,
      apiMethod,
      googleStatus,
      googleErrors,
    } = toSeoCacheStoreErrorMessage(error);

    const envDiagnostics = await buildDiagnosticsWithProbe();

    return NextResponse.json(
      {
        success: false,
        error: message,
        phase: apiMethod ?? "search-console",
        message,
        githubStatus: status,
        googleStatus,
        googleResponse: message,
        code,
        apiMethod,
        errors: googleErrors,
        envDiagnostics,
      },
      { status },
    );
  }
}
