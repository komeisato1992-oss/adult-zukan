import Link from "next/link";
import { ZukanCrossLinkCard } from "@/components/home/ZukanCrossLinkCard";
import { doujinSiteConfig } from "@/lib/doujin/site-config";

export function DoujinSiteIntroSection() {
  return (
    <section
      aria-labelledby="doujin-site-intro-heading"
      className="border-b border-border bg-white"
    >
      <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 id="doujin-site-intro-heading" className="sr-only">
            {doujinSiteConfig.name}
          </h1>

          <div className="space-y-4 text-base leading-relaxed text-muted sm:text-lg">
            <p>
              同人図鑑では、
              <strong className="font-semibold text-foreground">
                複数の同人作品を並べて比較
              </strong>
              できます。
            </p>
            <p>
              価格・サークル・作者・シリーズ・ジャンルなどを
              <br className="hidden sm:inline" />
              一画面で比較しながら作品を探せます。
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center">
            <div className="flex w-full flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/doujin/works"
                prefetch
                className="inline-flex h-11 min-w-[160px] flex-1 items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover sm:flex-none"
              >
                作品を探す
              </Link>
              <Link
                href="/doujin/compare"
                prefetch
                className="inline-flex h-11 min-w-[160px] flex-1 items-center justify-center rounded-lg border border-accent bg-white px-6 text-sm font-semibold text-accent transition-colors hover:bg-accent-light sm:flex-none"
              >
                比較機能を見る
              </Link>
            </div>

            <ZukanCrossLinkCard
              title="動画作品を探している方へ"
              description="動画作品を、女優・メーカー・レーベル・シリーズ・ジャンルから検索・比較できます。"
              label="アダルト図鑑を見る →"
              href="/"
              variant="adult"
              fromSite="doujin"
              toSite="adult"
              placement="top_hero_card"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
