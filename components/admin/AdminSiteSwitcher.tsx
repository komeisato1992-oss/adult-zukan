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
      className="grid w-full grid-cols-2 gap-0 overflow-hidden rounded-lg border border-border md:flex md:max-w-full md:w-auto md:items-center md:gap-1 md:overflow-visible md:rounded-none md:border-0"
      role="tablist"
      aria-label="管理対象サイト"
    >
      {TABS.map((tab) => {
        const selected = tab.site === active;
        const mobileAccent =
          tab.site === "doujin"
            ? selected
              ? "bg-[#fff0f4] text-[#e56b8a]"
              : "bg-white text-muted"
            : selected
              ? "bg-accent-light text-accent"
              : "bg-white text-muted";
        const desktopAccent =
          tab.site === "doujin"
            ? selected
              ? "md:border-[#F78FA7] md:bg-[#fff0f4] md:text-[#e56b8a]"
              : "md:border-border md:bg-white md:text-muted md:hover:border-[#F78FA7] md:hover:text-[#e56b8a]"
            : selected
              ? "md:border-accent md:bg-accent-light md:text-accent"
              : "md:border-border md:bg-white md:text-muted md:hover:border-accent md:hover:text-accent";

        return (
          <Link
            key={tab.site}
            href={adminSiteHomeHref(tab.site)}
            role="tab"
            aria-selected={selected}
            className={`inline-flex h-11 min-h-[44px] items-center justify-center px-2 text-center text-sm font-semibold transition-colors md:h-10 md:shrink-0 md:rounded-full md:border md:px-4 ${mobileAccent} ${desktopAccent} ${
              selected ? "relative z-[1]" : ""
            } ${tab.site === "adult" ? "border-r border-border md:border-r" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
