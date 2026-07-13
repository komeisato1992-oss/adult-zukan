"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/lib/site-config";
import { SearchBar } from "@/components/ui/SearchBar";
import { MobileNav } from "@/components/layout/MobileNav";
import { MainNav } from "@/components/layout/MainNav";

/** トップでコンパクトへ入る / 戻るスクロールしきい値（チャタリング防止） */
const SCROLL_ENTER_COMPACT = 56;
const SCROLL_EXIT_COMPACT = 20;

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-4.35-4.35m1.6-5.4a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
      />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [isCompact, setIsCompact] = useState(() => !isHome);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const compactRef = useRef(!isHome);
  const lockRef = useRef(false);

  useEffect(() => {
    lockRef.current = searchOpen || menuOpen;
  }, [searchOpen, menuOpen]);

  useEffect(() => {
    setSearchOpen(false);
    if (!isHome) {
      compactRef.current = true;
      setIsCompact(true);
      return;
    }

    let ticking = false;

    const applyCompact = (next: boolean) => {
      if (next === compactRef.current) return;
      compactRef.current = next;
      setIsCompact(next);
      if (!next) setSearchOpen(false);
    };

    const readScroll = () => {
      ticking = false;
      if (lockRef.current) return;
      const y = window.scrollY;
      if (compactRef.current) {
        if (y <= SCROLL_EXIT_COMPACT) applyCompact(false);
      } else if (y >= SCROLL_ENTER_COMPACT) {
        applyCompact(true);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(readScroll);
    };

    const initialY = window.scrollY;
    const initialCompact = initialY >= SCROLL_ENTER_COMPACT;
    compactRef.current = initialCompact;
    setIsCompact(initialCompact);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome, pathname]);

  const showExpandedMobile = isHome && !isCompact;

  return (
    <header
      className="sticky top-0 z-50 border-b border-border bg-white shadow-sm"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* PC (≥769px): 既存レイアウトを維持 */}
      <div className="mx-auto hidden max-w-7xl px-4 py-3 sm:px-6 min-[769px]:block">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="shrink-0"
            aria-label={`${siteConfig.name} トップページ`}
          >
            <Image
              src={siteConfig.logo}
              alt={siteConfig.name}
              width={240}
              height={64}
              className="h-8 w-auto max-w-[160px] sm:h-10 sm:max-w-[220px]"
              priority
            />
          </Link>

          <div className="hidden flex-1 min-[769px]:block">
            <SearchBar compact className="max-w-xl" inputId="site-search-desktop" />
          </div>
        </div>

        <Suspense fallback={null}>
          <MainNav />
        </Suspense>
      </div>

      {/* スマートフォン (≤768px) */}
      <div className="min-[769px]:hidden">
        <div
          className={`mx-auto max-w-7xl px-3 transition-[padding] duration-200 ease-out ${
            showExpandedMobile ? "py-3" : "py-0"
          }`}
        >
          <div
            className={`flex items-center gap-2 ${
              showExpandedMobile ? "min-h-10" : "h-14"
            }`}
          >
            <Link
              href="/"
              className="shrink-0"
              aria-label={`${siteConfig.name} トップページ`}
            >
              <Image
                src={siteConfig.logo}
                alt={siteConfig.name}
                width={240}
                height={64}
                className={
                  showExpandedMobile
                    ? "h-8 w-auto max-w-[160px] transition-[height,max-width] duration-200"
                    : "h-7 w-auto max-w-[128px] transition-[height,max-width] duration-200"
                }
                priority
                sizes="160px"
              />
            </Link>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {!showExpandedMobile ? (
                <button
                  type="button"
                  onClick={() => setSearchOpen((open) => !open)}
                  aria-expanded={searchOpen}
                  aria-controls="mobile-header-search"
                  aria-label={searchOpen ? "検索を閉じる" : "検索を開く"}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-foreground"
                >
                  <SearchIcon />
                </button>
              ) : null}
              <Suspense fallback={null}>
                <MobileNav onOpenChange={setMenuOpen} />
              </Suspense>
            </div>
          </div>

          {showExpandedMobile ? (
            <div className="mt-3 transition-opacity duration-200">
              <SearchBar compact inputId="site-search-mobile-expanded" />
            </div>
          ) : null}
        </div>

        {!showExpandedMobile && searchOpen ? (
          <div
            id="mobile-header-search"
            className="border-t border-border bg-white px-3 py-2"
          >
            <SearchBar
              compact
              autoFocus
              inputId="site-search-mobile-compact"
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
