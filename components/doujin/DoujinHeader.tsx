import Link from "next/link";
import { DoujinLogo } from "@/components/doujin/DoujinLogo";
import { DoujinMainNav } from "@/components/doujin/DoujinMainNav";
import { DoujinMobileNav } from "@/components/doujin/DoujinMobileNav";
import { DoujinSearchBar } from "@/components/doujin/DoujinSearchBar";
import { doujinSiteConfig } from "@/lib/doujin/site-config";

export function DoujinHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white shadow-sm">
      <div className="mx-auto max-w-[90rem] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/doujin"
            className="shrink-0"
            aria-label={`${doujinSiteConfig.name} トップページ`}
          >
            <DoujinLogo variant="header" priority />
          </Link>

          <div className="hidden flex-1 md:block">
            <DoujinSearchBar compact className="max-w-xl" />
          </div>

          <DoujinMobileNav />
        </div>

        <div className="mt-3 md:hidden">
          <DoujinSearchBar compact />
        </div>

        <DoujinMainNav />
      </div>
    </header>
  );
}
