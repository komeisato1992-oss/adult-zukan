"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
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

  if (href.includes("?")) {
    const [baseHref, query] = href.split("?");
    if (pathname !== baseHref) return false;
    const expected = new URLSearchParams(query);
    for (const [key, value] of expected.entries()) {
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  }

  const baseHref = href.split("?")[0];
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

type MobileNavProps = {
  onOpenChange?: (open: boolean) => void;
};

export function MobileNav({ onOpenChange }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const titleId = useId();

  function setMenuOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  useEffect(() => {
    setOpen(false);
    onOpenChange?.(false);
    // Close drawer on route change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="min-[769px]:hidden">
      <button
        type="button"
        onClick={() => setMenuOpen(!open)}
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        aria-label={open ? "メニューを閉じる" : "メニューを開く"}
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          )}
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="メニューを閉じる"
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="mobile-nav-drawer"
            aria-labelledby={titleId}
            className="fixed inset-y-0 right-0 z-[70] flex w-[min(88vw,360px)] max-w-[100vw] flex-col border-l border-border bg-white shadow-xl"
            style={{
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
              maxHeight: "100dvh",
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <p
                id={titleId}
                className="text-sm font-bold text-foreground"
              >
                メニュー
              </p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="メニューを閉じる"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
              <ul className="flex flex-col py-1">
                {navItems.map((item) => {
                  const active = isNavItemActive(
                    item.href,
                    pathname,
                    searchParams,
                  );

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        prefetch
                        onClick={() => setMenuOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={
                          active
                            ? "flex min-h-12 items-center bg-accent-light px-4 py-3 text-base font-medium text-accent"
                            : "flex min-h-12 items-center px-4 py-3 text-base text-foreground hover:bg-accent-light hover:text-accent"
                        }
                      >
                        {item.href === "/favorites" ? (
                          <FavoriteNavLabel />
                        ) : (
                          item.label
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
