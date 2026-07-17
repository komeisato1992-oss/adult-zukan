"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminSiteSwitcher } from "@/components/admin/AdminSiteSwitcher";
import { AdminBottomNavigation } from "@/components/admin/AdminBottomNavigation";
import { AdminMobileNavProvider } from "@/components/admin/AdminMobileNavContext";
import { parseOpsTab } from "@/lib/admin/ops-tabs";

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isOpsDashboard =
    pathname === "/admin" || pathname === "/admin/" || pathname === "/admin/dashboard";
  const activeTab = isOpsDashboard
    ? parseOpsTab(searchParams.get("tab"))
    : null;

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
    <AdminMobileNavProvider openMobileNav={() => setMobileOpen(true)}>
      <div className="min-h-screen max-w-full overflow-x-hidden bg-surface">
        <div className="mx-auto flex min-h-screen w-full max-w-[1400px] overflow-x-hidden">
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
            <header className="border-b border-border bg-white">
              <div className="px-3 py-2 md:px-4 md:py-3">
                {/* スマホ: ダッシュボードはメニューを sticky ヘッダーに委譲 */}
                <div className="flex items-center justify-between gap-2 md:hidden">
                  {!isOpsDashboard ? (
                    <button
                      type="button"
                      className="inline-flex h-11 min-h-[44px] items-center rounded-lg border border-border px-3 text-sm"
                      onClick={() => setMobileOpen(true)}
                    >
                      メニュー
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <AdminSiteSwitcher />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="inline-flex h-11 min-h-[44px] shrink-0 items-center rounded-lg border border-border px-3 text-sm text-foreground disabled:opacity-60"
                  >
                    {loggingOut ? "ログアウト中..." : "ログアウト"}
                  </button>
                </div>
                {!isOpsDashboard ? (
                  <div className="mt-2 md:hidden">
                    <AdminSiteSwitcher />
                  </div>
                ) : null}

                <div className="hidden items-center justify-between gap-3 md:flex">
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
                </div>
              </div>
            </header>

            <main
              className="min-w-0 max-w-full flex-1 overflow-x-hidden p-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 lg:pb-6"
            >
              <div className="mx-auto w-full max-w-full overflow-x-hidden">
                {children}
              </div>
            </main>
          </div>
        </div>

        <AdminBottomNavigation activeTab={activeTab} />
      </div>
    </AdminMobileNavProvider>
  );
}
