import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { toSeoCacheStoreErrorMessage } from "@/lib/admin/seo-cache-store";
import { getSeoDashboardData } from "@/lib/admin/seo-service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dashboard = await getSeoDashboardData();
    return NextResponse.json({
      data: dashboard.data,
      envDiagnostics: dashboard.envDiagnostics,
    });
  } catch (error) {
    const { message, status } = toSeoCacheStoreErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
