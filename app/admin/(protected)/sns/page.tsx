import { SnsManagement } from "@/components/admin/SnsManagement";
import { SnsXAccountBanner } from "@/components/admin/SnsXAccountBanner";

export default function AdminSnsPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          SNS管理
        </h1>
        <p className="mt-2 text-sm text-muted">今日の投稿スケジュール</p>
      </section>

      <SnsXAccountBanner />

      <SnsManagement />
    </div>
  );
}
