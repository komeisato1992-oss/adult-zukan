"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { doujinMobileBottomNavItems } from "@/lib/doujin/site-config";

function isActive(href: string, pathname: string): boolean {
  if (href === "/doujin") return pathname === "/doujin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DoujinBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="同人図鑑下部ナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-7xl items-stretch">
        {doujinMobileBottomNavItems.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium touch-manipulation ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span
                  className={`h-1 w-6 rounded-full ${active ? "bg-accent" : "bg-transparent"}`}
                  aria-hidden
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
