import { Suspense } from "react";
import { OpsDashboardClient } from "@/components/admin/OpsDashboardClient";
import { getOpsDashboardData } from "@/lib/admin/ops-service";

export const dynamic = "force-dynamic";

type AdminOpsDashboardPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function AdminOpsDashboardPage({
  searchParams,
}: AdminOpsDashboardPageProps) {
  const [{ tab }, data] = await Promise.all([
    searchParams,
    getOpsDashboardData(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted">
          運営ダッシュボードを読み込み中…
        </div>
      }
    >
      <OpsDashboardClient initialData={data} initialTab={tab} />
    </Suspense>
  );
}
