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
          <header className="border-b border-border bg-white px-4 py-2.5 md:px-4 md:py-3">
            {/* スマホ: 1段目 メニュー / ログアウト */}
            <div className="flex items-center justify-between gap-2 md:hidden">
              <button
                type="button"
                className="inline-flex h-11 min-h-[44px] items-center rounded-lg border border-border px-3 text-sm"
                onClick={() => setMobileOpen(true)}
              >
                メニュー
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex h-11 min-h-[44px] items-center rounded-lg border border-border px-3 text-sm text-foreground disabled:opacity-60"
              >
                {loggingOut ? "ログアウト中..." : "ログアウト"}
              </button>
            </div>
            {/* スマホ: 2段目 サイト切替 100% */}
            <div className="mt-2 md:hidden">
              <AdminSiteSwitcher />
            </div>

            {/* PC: 既存横並び */}
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
          </header>

          <main className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 md:p-6">
            <div className="mx-auto w-full max-w-full overflow-x-hidden">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
