"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminSiteSwitcher } from "@/components/admin/AdminSiteSwitcher";

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-surface">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl overflow-x-hidden">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-white lg:block">
          <AdminSidebar />
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="メニューを閉じる"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative h-full w-[min(18rem,85vw)] max-w-full bg-white shadow-xl">
              <AdminSidebar onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                className="inline-flex h-11 min-h-[44px] items-center rounded-lg border border-border px-3 text-sm lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                メニュー
              </button>
              <AdminSiteSwitcher />
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex h-11 min-h-[44px] items-center rounded-lg border border-border px-3 text-sm text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
            >
              {loggingOut ? "ログアウト中..." : "ログアウト"}
            </button>
          </header>

          <main className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 sm:p-6">
            <div className="mx-auto w-full max-w-full overflow-x-hidden">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
