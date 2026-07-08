"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FavoriteNavLabel } from "@/components/user/FavoriteNavLabel";
import { navItems } from "@/lib/site-config";

function isNavItemActive(
  href: string,
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/works") {
    return (
      pathname === "/works" &&
      !searchParams.get("q") &&
      !searchParams.get("sale") &&
      !searchParams.get("sort")
    );
  }

  if (href === "/works?sale=1") {
    return pathname === "/works" && searchParams.get("sale") === "1";
  }

  const baseHref = href.split("?")[0];
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

function navLinkClassName(active: boolean): string {
  return active
    ? "whitespace-nowrap rounded bg-accent-light px-3 py-2 text-sm font-medium text-accent"
    : "whitespace-nowrap rounded px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent-light hover:text-accent";
}

function renderNavLabel(href: string, label: string): ReactNode {
  if (href === "/favorites") {
    return <FavoriteNavLabel />;
  }
  return label;
}

export function MainNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav
      aria-label="グローバルナビゲーション"
      className="mt-3 hidden items-center gap-1 overflow-x-auto md:flex"
    >
      {navItems.map((item) => {
        const active = isNavItemActive(item.href, pathname, searchParams);

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

export function SidebarNavLink({
  href,
  label,
}: {
  href: string;
  label: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = isNavItemActive(href, pathname, searchParams);

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
      {href === "/favorites" ? <FavoriteNavLabel /> : label}
    </Link>
  );
}
