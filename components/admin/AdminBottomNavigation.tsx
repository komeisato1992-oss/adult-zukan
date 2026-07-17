"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminBottomNavigationProps = {
  activeTab?: string | null;
};

export function AdminBottomNavigation({
  activeTab,
}: AdminBottomNavigationProps) {
  const pathname = usePathname();

  if (
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/doujin")
  ) {
    return null;
  }

  const items = [
    {
      id: "home",
      label: "ホーム",
      href: "/admin",
      active:
        (pathname === "/admin" || pathname === "/admin/") &&
        (!activeTab || activeTab === "overview"),
    },
    {
      id: "works",
      label: "作品",
      href: "/admin/import",
      active: pathname.startsWith("/admin/import"),
    },
    {
      id: "analytics",
      label: "分析",
      href: "/admin?tab=ga4",
      active:
        (pathname === "/admin" || pathname === "/admin/") &&
        (activeTab === "ga4" ||
          activeTab === "search-console" ||
          activeTab === "dmm"),
    },
    {
      id: "seo",
      label: "SEO",
      href: "/admin/seo",
      active: pathname.startsWith("/admin/seo"),
    },
    {
      id: "settings",
      label: "設定",
      href: "/admin/settings",
      active: pathname.startsWith("/admin/settings"),
    },
  ] as const;

  return (
    <nav
      aria-label="管理画面ナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-[1400px] grid-cols-5">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold ${
                item.active
                  ? "text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span
                className={`h-1 w-6 rounded-full ${
                  item.active ? "bg-accent" : "bg-transparent"
                }`}
                aria-hidden
              />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
