import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    redirect("/admin/login");
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface p-4 text-sm text-muted">
          管理画面を読み込み中…
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
