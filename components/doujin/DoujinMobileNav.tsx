"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DoujinFavoriteNavLabel } from "@/components/doujin/DoujinFavoriteNavLabel";
import { doujinNavItems } from "@/lib/doujin/site-config";

function isDoujinNavActive(href: string, pathname: string): boolean {
  if (href === "/doujin") return pathname === "/doujin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type DoujinMobileNavProps = {
  onOpenChange?: (open: boolean) => void;
};

export function DoujinMobileNav({ onOpenChange }: DoujinMobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function setMenuOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div className="relative min-[769px]:hidden">
      <button
        type="button"
        onClick={() => setMenuOpen(!open)}
        aria-expanded={open}
        aria-controls="doujin-mobile-nav-menu"
        aria-label="メニューを開く"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-[22px] w-[22px]"
          aria-hidden="true"
        >
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          )}
        </svg>
      </button>

      {open ? (
        <nav
          id="doujin-mobile-nav-menu"
          aria-label="同人図鑑モバイルナビゲーション"
          className="absolute right-0 top-full z-50 mt-2 w-52 rounded border border-border bg-white py-2 shadow-lg"
        >
          {doujinNavItems.map((item) => {
            const active = isDoujinNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "block bg-accent-light px-4 py-2.5 text-sm font-medium text-accent"
                    : "block px-4 py-2.5 text-sm text-foreground hover:bg-accent-light hover:text-accent"
                }
              >
                {item.href === "/doujin/favorites" ? (
                  <DoujinFavoriteNavLabel />
                ) : (
                  item.label
                )}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
