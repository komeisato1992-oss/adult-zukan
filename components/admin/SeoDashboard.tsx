import { SeoDashboardClient } from "@/components/admin/SeoDashboardClient";
import { getSeoDashboardData } from "@/lib/admin/seo-service";

export async function SeoDashboard() {
  const dashboard = await getSeoDashboardData();
  return (
    <SeoDashboardClient
      initialData={dashboard.data}
      envDiagnostics={dashboard.envDiagnostics}
    />
  );
}
