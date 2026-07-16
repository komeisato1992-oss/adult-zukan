"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type MobileBottomNavItem = {
  href: string;
  label: ReactNode;
};

type MobileBottomNavBarProps = {
  items: readonly MobileBottomNavItem[];
  isActive: (href: string) => boolean;
  ariaLabel: string;
};

export function MobileBottomNavBar({
  items,
  isActive,
  ariaLabel,
}: MobileBottomNavBarProps) {
  return (
    <nav aria-label={ariaLabel}>
      <ul className="mx-auto flex max-w-7xl items-stretch">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                prefetch
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
