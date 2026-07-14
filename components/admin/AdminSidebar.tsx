"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavItems } from "@/lib/admin/navigation";
import { doujinAdminNavItems } from "@/lib/admin/doujin-navigation";
import {
  adminSiteFromPathname,
  type AdminSite,
} from "@/lib/admin/site-context";
import { siteConfig } from "@/lib/site-config";
import { doujinSiteConfig } from "@/lib/doujin/site-config";

type AdminSidebarProps = {
  onNavigate?: () => void;
};

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const site: AdminSite = adminSiteFromPathname(pathname);
  const items = site === "doujin" ? doujinAdminNavItems : adminNavItems;
  const brand =
    site === "doujin"
      ? { name: doujinSiteConfig.name, logo: doujinSiteConfig.logoIcon }
      : { name: siteConfig.name, logo: siteConfig.logoIcon };
  const homeHref = site === "doujin" ? "/admin/doujin" : "/admin";
  const activeClass =
    site === "doujin"
      ? "bg-[#fff0f4] font-medium text-[#e56b8a]"
      : "bg-accent-light font-medium text-accent";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-4">
        <Link
          href={homeHref}
          onClick={onNavigate}
          className="inline-flex items-center gap-2"
        >
          <Image
            src={brand.logo}
            alt={brand.name}
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <div>
            <p className="text-sm font-bold text-foreground">管理画面</p>
            <p className="text-xs text-muted">{brand.name}</p>
          </div>
        </Link>
      </div>

      <nav aria-label="管理画面メニュー" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive =
              item.href === homeHref
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            if (item.disabled) {
              return (
                <li key={item.id}>
                  <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted/70">
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                    <span className="ml-auto text-[10px]">準備中</span>
                  </span>
                </li>
              );
            }

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? activeClass
                      : "text-foreground hover:bg-surface"
                  }`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
