import type { Metadata } from "next";
import { DoujinEmptyState } from "@/components/doujin/DoujinEmptyState";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { DoujinWorkCard } from "@/components/doujin/DoujinWorkCard";
import {
  getDoujinPopularWorks,
  hasDoujinCatalogData,
} from "@/lib/doujin/catalog";
import { doujinPageIntros } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: "ランキング",
  description: doujinPageIntros.ranking,
  robots: { index: false, follow: false, nocache: true },
};

export default function DoujinRankingPage() {
  const hasData = hasDoujinCatalogData();
  const works = hasData ? getDoujinPopularWorks(20) : [];

  return (
    <DoujinPageLayout>
      <DoujinSimplePage title="ランキング" description={doujinPageIntros.ranking}>
        {!hasData ? (
          <DoujinEmptyState />
        ) : (
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {works.map((work, index) => (
              <div key={work.id} className="flex h-full flex-col">
                <p className="mb-2 text-sm font-bold text-accent">{index + 1}位</p>
                <div className="min-h-0 flex-1">
                  <DoujinWorkCard work={work} />
                </div>
              </div>
            ))}
          </div>
        )}
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
