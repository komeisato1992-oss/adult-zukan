"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/lib/site-config";
import { SearchBar } from "@/components/ui/SearchBar";
import { MobileNav } from "@/components/layout/MobileNav";
import { MainNav } from "@/components/layout/MainNav";
import { useCompactHeaderOnScroll } from "@/hooks/useCompactHeaderOnScroll";

function SearchIcon({ className = "h-[22px] w-[22px]" }: { className?: string }) {
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isCompact } = useCompactHeaderOnScroll({
    isHome,
    lockCompactToggle: searchOpen || menuOpen,
  });

  useEffect(() => {
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isCompact) setSearchOpen(false);
  }, [isCompact]);

  const showExpandedMobile = isHome && !isCompact;

  return (
    <header
      className="sticky top-0 z-50 border-b border-border bg-white shadow-sm"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* PC (≥769px): 全ページ共通でコンパクトヘッダー */}
      <div className="mx-auto hidden max-w-7xl px-4 py-1.5 sm:px-6 min-[769px]:block">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="shrink-0"
            aria-label={`${siteConfig.name} トップページ`}
          >
            <Image
              src={siteConfig.logoCompact}
              alt={siteConfig.name}
              width={1024}
              height={396}
              className="h-8 w-auto max-w-[200px] object-contain object-left sm:h-9 sm:max-w-[240px]"
              priority
              sizes="240px"
            />
          </Link>

          <div className="hidden flex-1 min-[769px]:block">
            <SearchBar compact className="max-w-xl" inputId="site-search-desktop" />
          </div>
        </div>

        <Suspense fallback={null}>
          <MainNav compact />
        </Suspense>
      </div>

      {/* スマートフォン (≤768px) */}
      <div className="min-[769px]:hidden">
        {showExpandedMobile ? (
          <div className="mx-auto max-w-7xl px-3 py-3">
            <div className="flex min-h-10 items-center gap-2">
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
                  className="h-8 w-auto max-w-[160px]"
                  priority
                  sizes="160px"
                />
              </Link>
              <div className="ml-auto flex shrink-0 items-center">
                <Suspense fallback={null}>
                  <MobileNav onOpenChange={setMenuOpen} />
                </Suspense>
              </div>
            </div>
            <div className="mt-3">
              <SearchBar compact inputId="site-search-mobile-expanded" />
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 overflow-hidden px-3">
            <Link
              href="/"
              className="flex h-10 max-w-[min(58vw,200px)] shrink items-center overflow-hidden"
              aria-label={`${siteConfig.name} トップページ`}
            >
              <Image
                src={siteConfig.logoCompact}
                alt={siteConfig.name}
                width={1024}
                height={396}
                className="h-9 max-h-9 w-auto max-w-full object-contain object-left"
                priority
                sizes="(max-width: 390px) 140px, 200px"
              />
            </Link>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setSearchOpen((open) => !open)}
                aria-expanded={searchOpen}
                aria-controls="mobile-header-search"
                aria-label={searchOpen ? "検索を閉じる" : "検索を開く"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground"
              >
                <SearchIcon />
              </button>
              <Suspense fallback={null}>
                <MobileNav onOpenChange={setMenuOpen} />
              </Suspense>
            </div>
          </div>
        )}

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
