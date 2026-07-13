import type { Metadata } from "next";
import { DoujinAuthorCard } from "@/components/doujin/DoujinAuthorCard";
import { DoujinAuthorListToolbar } from "@/components/doujin/DoujinAuthorListToolbar";
import { DoujinEmptyState } from "@/components/doujin/DoujinEmptyState";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { Pagination } from "@/components/ui/Pagination";
import { getDoujinAuthorListPageData } from "@/lib/doujin/author-list-data";
import { hasDoujinCatalogData } from "@/lib/doujin/catalog";
import { doujinPageIntros } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: "作者一覧",
  description: doujinPageIntros.authors,
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

type DoujinAuthorsPageProps = {
  searchParams: Promise<{
    sort?: string;
    perPage?: string;
    page?: string;
  }>;
};

export default async function DoujinAuthorsPage({
  searchParams,
}: DoujinAuthorsPageProps) {
  const params = await searchParams;
  const hasData = hasDoujinCatalogData();
  const listData = hasData
    ? getDoujinAuthorListPageData({
        sort: params.sort,
        perPage: params.perPage,
        page: params.page,
      })
    : null;

  return (
    <DoujinPageLayout>
      <DoujinSimplePage title="作者一覧" description={doujinPageIntros.authors}>
        {!hasData ? (
          <DoujinEmptyState />
        ) : !listData || listData.totalItems === 0 ? (
          <DoujinEmptyState
            title="作者情報が取得できた作品はまだありません"
            description="商品APIで作者情報が取得できた作品が追加されると、ここに表示されます。"
          />
        ) : (
          <>
            <DoujinAuthorListToolbar listData={listData} />
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {listData.pageItems.map((author) => (
                <DoujinAuthorCard key={author.id} author={author} />
              ))}
            </div>
            <Pagination
              currentPage={listData.currentPage}
              totalPages={listData.totalPages}
              basePath="/doujin/authors"
              query={{
                sort:
                  listData.sort === "workCount" ? undefined : listData.sort,
                perPage:
                  listData.perPage === 20
                    ? undefined
                    : String(listData.perPage),
              }}
            />
          </>
        )}
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
