import { OpsDashboardClient } from "@/components/admin/OpsDashboardClient";
import { getOpsDashboardData } from "@/lib/admin/ops-service";

export const dynamic = "force-dynamic";

export default async function AdminOpsDashboardPage() {
  const data = await getOpsDashboardData();
  return <OpsDashboardClient initialData={data} />;
}
