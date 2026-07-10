import { SeoDashboardClient } from "@/components/admin/SeoDashboardClient";
import { getSeoDashboardData } from "@/lib/admin/seo-service";

export async function SeoDashboard() {
  const data = await getSeoDashboardData();
  return <SeoDashboardClient initialData={data} />;
}
