import { SeoDashboard } from "@/components/admin/SeoDashboard";

export const dynamic = "force-dynamic";

export default async function AdminSeoPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          SEO管理
        </h1>
        <p className="mt-2 text-sm text-muted">
          Google Search Console のデータを管理画面で確認できます。
        </p>
      </section>

      <SeoDashboard />
    </div>
  );
}
