import Image from "next/image";
import Link from "next/link";
import { PageLayout } from "@/components/layout/PageLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { createPageMetadata } from "@/lib/seo/metadata";
import { navItems, legalLinks, siteConfig } from "@/lib/site-config";

export const metadata = createPageMetadata({
  title: "ページが見つかりません",
  description:
    "お探しのページは見つかりませんでした。URLが間違っているか、ページが移動した可能性があります。トップページやサイトマップから目的のページをお探しください。",
  noIndex: true,
});

export default function NotFound() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "ページが見つかりません",
          description: "404 Not Found",
        }}
      />
      <PageLayout showSidebar={false}>
        <div className="flex flex-col items-center py-16 text-center">
          <Image
            src={siteConfig.logoIcon}
            alt={siteConfig.name}
            width={120}
            height={120}
            className="h-24 w-24"
            priority
          />
          <p className="mt-6 text-7xl font-bold text-border">404</p>
          <h1 className="mt-4 text-xl font-bold text-foreground">
            ページが見つかりません
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            URLが間違っているか、ページが移動・削除された可能性があります。
            下記リンクから目的のページをお探しください。
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex h-11 items-center rounded bg-accent px-6 text-sm font-medium text-white hover:bg-accent-hover"
          >
            トップページへ戻る
          </Link>
          <nav aria-label="404ページナビゲーション" className="mt-10">
            <ul className="flex flex-wrap justify-center gap-4">
              {navItems.slice(0, 6).map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-accent hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
              {legalLinks.slice(0, 2).map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-accent hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </PageLayout>
    </>
  );
}
