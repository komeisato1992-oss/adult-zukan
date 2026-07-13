"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DoujinFavoriteNavLabel } from "@/components/doujin/DoujinFavoriteNavLabel";
import { doujinNavItems } from "@/lib/doujin/site-config";

function isDoujinNavActive(href: string, pathname: string): boolean {
  if (href === "/doujin") {
    return pathname === "/doujin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClassName(active: boolean): string {
  return active
    ? "whitespace-nowrap rounded bg-accent-light px-3 py-2 text-sm font-medium text-accent"
    : "whitespace-nowrap rounded px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent-light hover:text-accent";
}

function renderNavLabel(href: string, label: string): ReactNode {
  if (href === "/doujin/favorites") {
    return <DoujinFavoriteNavLabel />;
  }
  return label;
}

export function DoujinMainNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="同人図鑑ナビゲーション"
      className="mt-3 hidden items-center gap-1 overflow-x-auto md:flex"
    >
      {doujinNavItems.map((item) => {
        const active = isDoujinNavActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={navLinkClassName(active)}
          >
            {renderNavLabel(item.href, item.label)}
          </Link>
        );
      })}
    </nav>
  );
}

export function DoujinSidebarNavLink({
  href,
  label,
}: {
  href: string;
  label: ReactNode;
}) {
  const pathname = usePathname();
  const active = isDoujinNavActive(href, pathname);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "block rounded bg-accent-light px-2 py-1.5 text-sm font-medium text-accent"
          : "block rounded px-2 py-1.5 text-sm text-muted transition-colors hover:bg-accent-light hover:text-accent"
      }
    >
      {href === "/doujin/favorites" ? <DoujinFavoriteNavLabel /> : label}
    </Link>
  );
}
