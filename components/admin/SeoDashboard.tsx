import { Suspense } from "react";
import { SeoDashboardClient } from "@/components/admin/SeoDashboardClient";
import { getSeoDashboardData } from "@/lib/admin/seo-service";

function SeoDashboardFallback() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-xl bg-surface" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl bg-surface"
          />
        ))}
      </div>
    </div>
  );
}

export async function SeoDashboard() {
  const dashboard = await getSeoDashboardData();
  return (
    <Suspense fallback={<SeoDashboardFallback />}>
      <SeoDashboardClient
        initialData={dashboard.data}
        envDiagnostics={dashboard.envDiagnostics}
      />
    </Suspense>
  );
}
