import Link from "next/link";
import { DoujinGuideCrossLinkCard } from "@/components/home/DoujinGuideCrossLinkCard";
import { FooterFavoritesLink } from "@/components/layout/FooterFavoritesLink";
import { FooterZukanSwitch } from "@/components/layout/FooterZukanSwitch";
import {
  legalLinks,
  navItems,
  sidebarSections,
  siteConfig,
} from "@/lib/site-config";

const MOBILE_LEGAL_HREFS = new Set([
  "/about",
  "/faq",
  "/terms",
  "/privacy",
  "/contact",
  "/age-restriction",
  "/history",
]);

const mobileLegalLinks = legalLinks.filter((link) =>
  MOBILE_LEGAL_HREFS.has(link.href),
);

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      {/* スマホ専用フッター構成 */}
      <div className="mx-auto max-w-7xl px-4 py-6 min-[769px]:hidden">
        <div className="rounded-xl bg-[#FFF5F7] px-2 py-2">
          <DoujinGuideCrossLinkCard
            placement="footer_cross_link_card"
            className="mt-0 max-w-none"
          />
        </div>

        <section aria-labelledby="footer-about-mobile" className="mt-5">
          <h2
            id="footer-about-mobile"
            className="text-base font-bold text-accent"
          >
            {siteConfig.name}
          </h2>
          <p className="mt-1.5 text-xs leading-snug text-muted">
            作品・女優・メーカー・ジャンル・シリーズから
            <br />
            作品を探して比較できるAV作品データベースです。
          </p>
        </section>

        <nav aria-labelledby="footer-nav-mobile" className="mt-5">
          <h2
            id="footer-nav-mobile"
            className="text-xs font-bold text-foreground"
          >
            サイトマップ
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                {item.href === "/favorites" ? (
                  <FooterFavoritesLink className="inline-flex min-h-[36px] items-center text-xs text-muted hover:text-accent" />
                ) : (
                  <Link
                    href={item.href}
                    className="inline-flex min-h-[36px] items-center text-xs text-muted hover:text-accent"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-legal-mobile" className="mt-5">
          <h2
            id="footer-legal-mobile"
            className="text-xs font-bold text-foreground"
          >
            法的情報
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {mobileLegalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-[36px] items-center text-xs text-muted hover:text-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-snug text-muted/90">
            当サイトはアフィリエイト広告（DMMアフィリエイト等）を利用しています。
          </p>
        </nav>

        <p className="mt-5 border-t border-border pt-4 text-center text-[11px] text-muted">
          © {currentYear} {siteConfig.name}. All rights reserved.{" "}
          <Link href="/feed.xml" className="hover:text-accent">
            RSS
          </Link>
        </p>
      </div>

      {/* PCフッター（従来レイアウトを維持） */}
      <div className="mx-auto hidden max-w-7xl px-4 py-10 min-[769px]:block sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <section aria-labelledby="footer-about" className="lg:col-span-2">
            <h2 id="footer-about" className="text-sm font-bold text-accent">
              {siteConfig.name}
            </h2>
            <div className="mt-4">
              <FooterZukanSwitch currentSite="adult" />
            </div>
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
