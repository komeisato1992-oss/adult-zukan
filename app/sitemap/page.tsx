import Link from "next/link";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  siteConfig,
  pageIntros,
  navItems,
  legalLinks,
} from "@/lib/site-config";
import { getAllGenres } from "@/data/genres";
import { getAllMakers } from "@/data/makers";
import { getAllSeries } from "@/data/series";
import { getAllActresses } from "@/data/actresses";
import { getAllLabels } from "@/data/labels";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createBreadcrumbJsonLd } from "@/lib/seo/json-ld";

export const metadata = createPageMetadata({
  title: "サイトマップ",
  description: pageIntros.sitemap,
  path: "/sitemap",
});

export default function SitemapPage() {
  const genres = getAllGenres();
  const makers = getAllMakers();
  const series = getAllSeries();
  const actresses = getAllActresses();
  const labels = getAllLabels();

  return (
    <>
      <JsonLd
        data={createBreadcrumbJsonLd([
          { name: "トップ", path: "/" },
          { name: "サイトマップ", path: "/sitemap" },
        ])}
      />
      <PageLayout showSidebar={false}>
        <Breadcrumb
          items={[{ label: "トップ", href: "/" }, { label: "サイトマップ" }]}
        />
        <header className="mt-4 mb-8">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            サイトマップ
          </h1>
          <PageIntro text={pageIntros.sitemap} />
        </header>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <nav aria-labelledby="sitemap-main">
            <h2 id="sitemap-main" className="mb-3 text-sm font-bold text-foreground">
              メインコンテンツ
            </h2>
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-muted hover:text-accent">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/about" className="text-sm text-muted hover:text-accent">
                  アダルト図鑑とは
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-muted hover:text-accent">
                  FAQ
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="sitemap-legal">
            <h2 id="sitemap-legal" className="mb-3 text-sm font-bold text-foreground">
              法的情報
            </h2>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted hover:text-accent">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="sitemap-genres">
            <h2 id="sitemap-genres" className="mb-3 text-sm font-bold text-foreground">
              ジャンル
            </h2>
            <ul className="space-y-2">
              {genres.map((genre) => (
                <li key={genre.slug}>
                  <Link
                    href={`/genres/${genre.slug}`}
                    className="text-sm text-muted hover:text-accent"
                  >
                    {genre.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="sitemap-makers">
            <h2 id="sitemap-makers" className="mb-3 text-sm font-bold text-foreground">
              メーカー
            </h2>
            <ul className="space-y-2">
              {makers.map((maker) => (
                <li key={maker.slug}>
                  <Link
                    href={`/makers/${maker.slug}`}
                    className="text-sm text-muted hover:text-accent"
                  >
                    {maker.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="sitemap-series">
            <h2 id="sitemap-series" className="mb-3 text-sm font-bold text-foreground">
              シリーズ
            </h2>
            <ul className="space-y-2">
              {series.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/series/${s.slug}`}
                    className="text-sm text-muted hover:text-accent"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="sitemap-labels">
            <h2 id="sitemap-labels" className="mb-3 text-sm font-bold text-foreground">
              レーベル
            </h2>
            <ul className="space-y-2">
              {labels.map((label) => (
                <li key={label.slug}>
                  <Link
                    href={`/labels/${label.slug}`}
                    className="text-sm text-muted hover:text-accent"
                  >
                    {label.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="sitemap-actresses">
            <h2 id="sitemap-actresses" className="mb-3 text-sm font-bold text-foreground">
              女優
            </h2>
            <ul className="space-y-2">
              {actresses.map((actress) => (
                <li key={actress.slug}>
                  <Link
                    href={`/actresses/${actress.slug}`}
                    className="text-sm text-muted hover:text-accent"
                  >
                    {actress.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-10 text-xs text-muted">
          XMLサイトマップ:{" "}
          <a href="/sitemap.xml" className="text-accent hover:underline">
            {siteConfig.url}/sitemap.xml
          </a>
        </p>
      </PageLayout>
    </>
  );
}
