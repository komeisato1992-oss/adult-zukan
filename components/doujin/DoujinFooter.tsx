import Link from "next/link";
import { DoujinFooterFavoritesLink } from "@/components/doujin/DoujinFooterFavoritesLink";
import { FooterZukanSwitch } from "@/components/layout/FooterZukanSwitch";
import {
  doujinLegalLinks,
  doujinNavItems,
  doujinSidebarSections,
  doujinSiteConfig,
} from "@/lib/doujin/site-config";

export function DoujinFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface pb-20 md:pb-0">
      <div className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <section aria-labelledby="doujin-footer-about" className="lg:col-span-2">
            <h2 id="doujin-footer-about" className="sr-only">
              {doujinSiteConfig.name}
            </h2>
            <FooterZukanSwitch currentSite="doujin" />
          </section>

          <nav aria-labelledby="doujin-footer-nav">
            <h2 id="doujin-footer-nav" className="text-sm font-bold text-foreground">
              サイトマップ
            </h2>
            <ul className="mt-3 space-y-2">
              {doujinNavItems.map((item) => (
                <li key={item.href}>
                  {item.href === "/doujin/favorites" ? (
                    <DoujinFooterFavoritesLink />
                  ) : (
                    <Link
                      href={item.href}
                      className="text-sm text-muted hover:text-accent"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="doujin-footer-genres">
            <h2 id="doujin-footer-genres" className="text-sm font-bold text-foreground">
              ジャンル
            </h2>
            <ul className="mt-3 space-y-2">
              {doujinSidebarSections[1].links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="doujin-footer-legal">
            <h2 id="doujin-footer-legal" className="text-sm font-bold text-foreground">
              法的情報
            </h2>
            <ul className="mt-3 space-y-2">
              {doujinLegalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted/90">
              当サイトはアフィリエイト広告（DMMアフィリエイト等）を利用しています。
            </p>
          </nav>
        </div>

        <p className="mt-8 border-t border-border pt-6 text-center text-xs text-muted">
          © {currentYear} {doujinSiteConfig.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
