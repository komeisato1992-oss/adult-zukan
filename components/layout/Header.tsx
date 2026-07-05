import Link from "next/link";
import { navItems, siteConfig } from "@/lib/site-config";
import { SearchBar } from "@/components/ui/SearchBar";
import { MobileNav } from "@/components/layout/MobileNav";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white shadow-sm">
      <div className="border-b border-border bg-accent-light">
        <div className="mx-auto max-w-7xl px-4 py-1.5 text-center text-xs text-muted sm:px-6">
          <Link href="/age-restriction" className="hover:text-accent">
            18歳未満の方の閲覧は固くお断りします
          </Link>
          。当サイトはアフィリエイトリンクを含みます。
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="shrink-0 text-xl font-bold text-accent"
            aria-label={`${siteConfig.name} トップページ`}
          >
            {siteConfig.name}
          </Link>

          <div className="hidden flex-1 md:block">
            <SearchBar compact className="max-w-xl" />
          </div>

          <MobileNav />
        </div>

        <div className="mt-3 md:hidden">
          <SearchBar compact />
        </div>

        <nav
          aria-label="グローバルナビゲーション"
          className="mt-3 hidden items-center gap-1 overflow-x-auto md:flex"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent-light hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
