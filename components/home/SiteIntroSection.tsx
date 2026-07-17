import Link from "next/link";
import { QuickCompareHeroLink } from "@/components/home/QuickCompareHeroLink";
import { DoujinGuideCrossLinkCard } from "@/components/home/DoujinGuideCrossLinkCard";
import type { QuickCompareResult } from "@/lib/compare/quick-compare-types";

type SiteIntroSectionProps = {
  quickCompare?: QuickCompareResult;
};

export function SiteIntroSection({ quickCompare }: SiteIntroSectionProps) {
  const compareHref = quickCompare?.href ?? "/compare";
  const selectionType = quickCompare?.selectionType ?? "fallback";
  const workId1 = quickCompare?.workIds[0];
  const workId2 = quickCompare?.workIds[1];

  return (
    <section
      aria-labelledby="site-intro-heading"
      className="border-b border-border bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1
            id="site-intro-heading"
            className="text-[1.15rem] font-bold leading-tight text-foreground sm:text-3xl sm:leading-tight lg:text-4xl"
          >
            作品選びを、もっと便利に。
          </h1>

          <div className="mt-2.5 space-y-1.5 text-xs leading-tight text-muted sm:mt-6 sm:space-y-4 sm:text-lg sm:leading-relaxed">
            <p>
              アダルト図鑑では、
              <strong className="font-semibold text-foreground">
                複数の作品を並べて比較
              </strong>
              できます。
            </p>
            <p>
              価格・女優・メーカー・シリーズ・ジャンルなどを
              <br className="hidden sm:inline" />
              一画面で比較しながら作品選びができます。
            </p>
            <p>
              日本では珍しい
              <strong className="font-semibold text-foreground">
                AV作品比較サイト
              </strong>
              です。
            </p>
          </div>

          <div className="mt-3.5 flex flex-col items-center sm:mt-8">
            <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-4">
              <Link
                href="/works"
                prefetch
                className="inline-flex h-9 min-w-[130px] flex-1 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover sm:h-11 sm:min-w-[160px] sm:flex-none sm:px-6"
              >
                作品を探す
              </Link>
              <QuickCompareHeroLink
                href={compareHref}
                selectionType={selectionType}
                workId1={workId1}
                workId2={workId2}
                className="inline-flex h-9 min-w-[130px] flex-1 items-center justify-center rounded-lg border border-accent bg-white px-4 text-sm font-semibold text-accent transition-colors hover:bg-[#FFF2F2] sm:h-11 sm:min-w-[160px] sm:flex-none sm:px-6"
              >
                比較機能を見る
              </QuickCompareHeroLink>
            </div>

            <DoujinGuideCrossLinkCard placement="top_hero_card" />
          </div>
        </div>
      </div>
    </section>
  );
}
