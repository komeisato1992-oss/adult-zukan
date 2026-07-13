import type { Metadata } from "next";
import { DoujinEmptyState } from "@/components/doujin/DoujinEmptyState";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { DoujinWorksListSection } from "@/components/doujin/DoujinWorksListSection";
import { hasDoujinCatalogData } from "@/lib/doujin/catalog";
import { parseDoujinWorksListQuery } from "@/lib/doujin/list-filters";
import { getDoujinWorksListPageData } from "@/lib/doujin/list-page";
import { doujinPageIntros } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: "作品一覧",
  description: doujinPageIntros.works,
  robots: { index: false, follow: false, nocache: true },
};

type DoujinWorksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DoujinWorksPage({
  searchParams,
}: DoujinWorksPageProps) {
  const params = await searchParams;
  const queryState = parseDoujinWorksListQuery(params);
  const hasData = hasDoujinCatalogData();
  const data = hasData ? getDoujinWorksListPageData(queryState) : null;

  return (
    <DoujinPageLayout>
      <DoujinSimplePage title="作品一覧" description={doujinPageIntros.works}>
        {!hasData || !data ? (
          <DoujinEmptyState />
        ) : (
          <DoujinWorksListSection
            works={data.works}
            totalItems={data.totalItems}
            totalPages={data.totalPages}
            currentPage={data.currentPage}
            queryState={queryState}
            sort={data.sort}
            genreOptions={data.genreOptions}
            circleOptions={data.circleOptions}
            formatOptions={data.formatOptions}
            yearOptions={data.yearOptions}
          />
        )}
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
