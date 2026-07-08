import { TodayTasksCard } from "@/components/admin/TodayTasksCard";
import { SiteStatsGrid } from "@/components/admin/SiteStatsGrid";
import { getAdminSiteStats } from "@/lib/admin/stats";

export default async function AdminDashboardPage() {
  const stats = await getAdminSiteStats();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-muted">運営ダッシュボード</p>
      </section>

      <TodayTasksCard />

      <section>
        <h2 className="mb-4 text-lg font-bold text-foreground">サイト情報</h2>
        <SiteStatsGrid stats={stats} />
      </section>
    </div>
  );
}
