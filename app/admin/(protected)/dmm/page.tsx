import { DmmReportsClient } from "@/components/admin/DmmReportsClient";
import { getDmmAdminStatus } from "@/lib/admin/dmm-affiliate-service";

export const dynamic = "force-dynamic";

export default async function AdminDmmPage() {
  const status = await getDmmAdminStatus();
  return <DmmReportsClient initialStatus={status} />;
}
