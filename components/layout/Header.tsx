import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { siteConfig } from "@/lib/site-config";
import { SearchBar } from "@/components/ui/SearchBar";
import { MobileNav } from "@/components/layout/MobileNav";
import { MainNav } from "@/components/layout/MainNav";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
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

          <div className="hidden flex-1 md:block">
            <SearchBar compact className="max-w-xl" />
          </div>

          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
        </div>

        <div className="mt-3 md:hidden">
          <SearchBar compact />
        </div>

        <Suspense fallback={null}>
          <MainNav />
        </Suspense>
      </div>
    </header>
  );
}
