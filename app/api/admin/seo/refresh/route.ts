import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { toSeoCacheStoreErrorMessage } from "@/lib/admin/seo-cache-store";
import { buildSeoEnvDiagnostics, logSeoEnvPresence } from "@/lib/admin/seo-env-diagnostics";
import { refreshSeoDashboardData } from "@/lib/admin/seo-service";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logSeoEnvPresence();

  try {
    const data = await refreshSeoDashboardData();
    const envDiagnostics = buildSeoEnvDiagnostics();
    return NextResponse.json({ success: true, data, envDiagnostics });
  } catch (error) {
    const { message, status } = toSeoCacheStoreErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
