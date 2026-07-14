"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  ADMIN_SITE_STORAGE_KEY,
  adminSiteFromPathname,
  adminSiteHomeHref,
  type AdminSite,
} from "@/lib/admin/site-context";

const TABS: Array<{ site: AdminSite; label: string }> = [
  { site: "adult", label: "アダルト図鑑" },
  { site: "doujin", label: "同人図鑑" },
];

export function AdminSiteSwitcher() {
  const pathname = usePathname();
  const active = adminSiteFromPathname(pathname);

  useEffect(() => {
    try {
      window.localStorage.setItem(ADMIN_SITE_STORAGE_KEY, active);
    } catch {
      // ignore
    }
  }, [active]);

  return (
    <div
      className="flex max-w-full items-center gap-1 overflow-x-auto"
      role="tablist"
      aria-label="管理対象サイト"
    >
      {TABS.map((tab) => {
        const selected = tab.site === active;
        const accent =
          tab.site === "doujin"
            ? selected
              ? "border-[#F78FA7] bg-[#fff0f4] text-[#e56b8a]"
              : "border-border bg-white text-muted hover:border-[#F78FA7] hover:text-[#e56b8a]"
            : selected
              ? "border-accent bg-accent-light text-accent"
              : "border-border bg-white text-muted hover:border-accent hover:text-accent";

        return (
          <Link
            key={tab.site}
            href={adminSiteHomeHref(tab.site)}
            role="tab"
            aria-selected={selected}
            className={`inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold transition-colors sm:h-10 sm:px-4 sm:text-sm ${accent}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
