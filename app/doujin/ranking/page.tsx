import type { Metadata } from "next";
import { DoujinEmptyState } from "@/components/doujin/DoujinEmptyState";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { DoujinWorkCard } from "@/components/doujin/DoujinWorkCard";
import { DOUJIN_WORK_LIST_GRID_CLASSNAME } from "@/components/works/work-list-grid";
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
          <div className={DOUJIN_WORK_LIST_GRID_CLASSNAME}>
            {works.map((work, index) => (
              <div key={work.id} className="flex h-full flex-col">
                <p className="mb-2 text-sm font-bold text-accent max-[768px]:mb-1 max-[768px]:text-xs">
                  {index + 1}位
                </p>
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
