import type { Metadata } from "next";
import { DoujinContentLinksSection } from "@/components/doujin/DoujinContentLinksSection";
import { DoujinEmptyState } from "@/components/doujin/DoujinEmptyState";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinPopularGenreSection } from "@/components/doujin/DoujinPopularGenreSection";
import { DoujinRandomCompareSection } from "@/components/doujin/DoujinRandomCompareSection";
import { DoujinSalePromoSection } from "@/components/doujin/DoujinSalePromoSection";
import { DoujinSiteIntroSection } from "@/components/doujin/DoujinSiteIntroSection";
import { DoujinWorkScrollSection } from "@/components/doujin/DoujinWorkScrollSection";
import { DoujinWorksDiscoverSection } from "@/components/doujin/DoujinWorksDiscoverSection";
import {
  getDoujinGenreList,
  getDoujinPopularWorks,
  getDoujinRandomComparePair,
  getDoujinSaleWorks,
  hasDoujinCatalogData,
} from "@/lib/doujin/catalog";
import { doujinPageIntros, doujinSiteConfig } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: {
    absolute: `${doujinSiteConfig.name} | ${doujinSiteConfig.tagline}`,
  },
  description: doujinPageIntros.home,
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DoujinHomePage() {
  const hasData = hasDoujinCatalogData();
  const popularWorks = hasData ? getDoujinPopularWorks(8) : [];
  const saleWorks = hasData ? getDoujinSaleWorks(8) : [];
  const genres = hasData ? getDoujinGenreList().slice(0, 8) : [];
  const randomComparePair = hasData ? getDoujinRandomComparePair() : null;

  return (
    <>
      <DoujinSiteIntroSection />

      {randomComparePair ? (
        <DoujinRandomCompareSection items={randomComparePair} />
      ) : null}

      <DoujinPageLayout>
        <DoujinContentLinksSection />
        {hasData ? (
          <>
            <DoujinPopularGenreSection genres={genres} />
            <DoujinSalePromoSection />
            <DoujinWorksDiscoverSection />
            <DoujinWorkScrollSection
              id="popular-doujin-works"
              title="🔥 人気同人作品"
              items={popularWorks}
              href="/doujin/works"
            />
            <DoujinWorkScrollSection
              id="sale-doujin-works"
              title="💰 セール同人作品"
              items={saleWorks}
              href="/doujin/sale"
            />
          </>
        ) : (
          <DoujinEmptyState />
        )}

        <section
          aria-labelledby="doujin-about-site"
          className="mb-12 rounded-xl border border-border bg-white p-5 sm:p-6"
        >
          <h2 id="doujin-about-site" className="text-lg font-bold text-foreground">
            同人図鑑について
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {doujinSiteConfig.description}
          </p>
        </section>
      </DoujinPageLayout>
    </>
  );
}
