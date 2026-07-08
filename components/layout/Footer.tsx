import Link from "next/link";
import { FooterFavoritesLink } from "@/components/layout/FooterFavoritesLink";
import { navItems, siteConfig, sidebarSections, legalLinks } from "@/lib/site-config";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <section aria-labelledby="footer-about" className="lg:col-span-2">
            <h2 id="footer-about" className="text-sm font-bold text-accent">
              {siteConfig.name}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {siteConfig.description}
            </p>
          </section>

          <nav aria-labelledby="footer-nav">
            <h2 id="footer-nav" className="text-sm font-bold text-foreground">
              サイトマップ
            </h2>
            <ul className="mt-3 space-y-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  {item.href === "/favorites" ? (
                    <FooterFavoritesLink />
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

          <nav aria-labelledby="footer-genres">
            <h2 id="footer-genres" className="text-sm font-bold text-foreground">
              ジャンル
            </h2>
            <ul className="mt-3 space-y-2">
              {sidebarSections[1].links.map((link) => (
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
          </nav>

          <nav aria-labelledby="footer-legal">
            <h2 id="footer-legal" className="text-sm font-bold text-foreground">
              法的情報
            </h2>
            <ul className="mt-3 space-y-2">
              {legalLinks.map((link) => (
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
          © {currentYear} {siteConfig.name}. All rights reserved.{" "}
          <Link href="/feed.xml" className="hover:text-accent">
            RSS
          </Link>
        </p>
      </div>
    </footer>
  );
}
