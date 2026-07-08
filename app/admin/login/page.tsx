import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { siteConfig } from "@/lib/site-config";

export default async function AdminLoginPage() {
  const authenticated = await isAdminAuthenticated();
  if (authenticated) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 shadow-sm">
        <h1 className="text-center text-xl font-bold text-foreground">
          {siteConfig.name} 管理画面
        </h1>
        <AdminLoginForm />
      </div>
    </div>
  );
}
