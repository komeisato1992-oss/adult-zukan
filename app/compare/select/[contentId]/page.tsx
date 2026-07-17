import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareSelectPagination } from "@/components/compare/CompareSelectPagination";
import { CompareSelectSortTabs } from "@/components/compare/CompareSelectSortTabs";
import { SimilarWorkSelectCard } from "@/components/compare/SimilarWorkSelectCard";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CatalogWorkImage } from "@/components/ui/CatalogWorkImage";
import { getSimilarWorks } from "@/lib/compare/get-similar-works";
import {
  COMPARE_SELECT_MAX_PAGES,
  COMPARE_SELECT_PAGE_SIZE,
  parseSimilaritySort,
  SIMILARITY_SORT_LABELS,
} from "@/lib/compare/similarity";
import { buildCompareSelectHref } from "@/lib/compare/urls";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemMakerName,
  getDmmItemPrice,
  getDmmListItemImageUrl,
} from "@/lib/dmm/display";
import { getDmmWorkByContentId } from "@/lib/dmm/get-work";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { createPageMetadata } from "@/lib/seo/metadata";

type CompareSelectPageProps = {
  params: Promise<{ contentId: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: CompareSelectPageProps) {
  const { contentId } = await params;
  await searchParams;
  const work = await getDmmWorkByContentId(contentId);
  const titleBase = work?.title
    ? `${work.title}の比較候補`
    : "比較候補の選択";
  const description = work?.title
    ? `「${work.title}」に似ている作品から比較対象を選べます。`
    : "似ている作品から比較対象を選べます。";

  // 機能ページ: noindex,follow。canonical はクエリなしの正規URL
  return createPageMetadata({
    title: titleBase,
    description,
    path: buildCompareSelectHref(contentId),
    canonicalPath: buildCompareSelectHref(contentId),
    noIndex: true,
    follow: true,
  });
}

export default async function CompareSelectPage({
  params,
  searchParams,
}: CompareSelectPageProps) {
  const { contentId } = await params;
  const query = await searchParams;
  const sort = parseSimilaritySort(query.sort);
  const page = parsePageParam(query.page);

  const anchor = await getDmmWorkByContentId(contentId);
  if (!anchor) {
    notFound();
  }

  const allCandidates = await getSimilarWorks(contentId, sort);
  const totalPages = Math.min(
    COMPARE_SELECT_MAX_PAGES,
    Math.max(1, Math.ceil(allCandidates.length / COMPARE_SELECT_PAGE_SIZE)),
  );
  const currentPage = Math.min(page, totalPages);
  const paginated = paginateItems(
    allCandidates,
    currentPage,
    COMPARE_SELECT_PAGE_SIZE,
  );

  const imageUrl =
    getDmmListItemImageUrl(anchor) ?? getDmmItemImageUrl(anchor);
  const actressNames = getDmmItemActressNameList(anchor);
  const makerName = getDmmItemMakerName(anchor);
  const price = getDmmItemPrice(anchor);

  return (
    <PageLayout>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "作品比較", href: "/compare" },
          { label: "比較候補" },
        ]}
      />

      <header className="mt-4 mb-4">
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          比較する作品を選ぶ
        </h1>
        <p className="mt-2 text-sm text-muted">
          {SIMILARITY_SORT_LABELS[sort]}
          の候補から、比較する2作品目を選んでください。
        </p>
      </header>

      <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-muted">比較元の作品</h2>
        <div className="mt-3 flex gap-4">
          <Link
            href={`/works/${anchor.content_id}`}
            className="relative block w-24 shrink-0 overflow-hidden rounded border border-border sm:w-28"
          >
            {imageUrl ? (
              <CatalogWorkImage
                src={imageUrl}
                alt={anchor.title}
                variant="portrait"
                sizes="112px"
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center bg-surface text-xs text-muted">
                画像なし
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/works/${anchor.content_id}`}
              className="line-clamp-2 text-base font-bold text-foreground hover:text-accent"
            >
              {anchor.title}
            </Link>
            {actressNames.length > 0 ? (
              <p className="mt-1 line-clamp-1 text-sm text-muted">
                {actressNames.join("、")}
              </p>
            ) : null}
            {makerName ? (
              <p className="mt-0.5 text-xs text-muted">{makerName}</p>
            ) : null}
            {price ? (
              <p className="mt-1 text-sm font-bold text-price">{price}</p>
            ) : null}
          </div>
        </div>
      </section>

      <p className="mt-6 text-sm font-medium text-foreground">
        この作品と比較する作品を選んでください
      </p>

      <CompareSelectSortTabs contentId={contentId} currentSort={sort} />

      {paginated.items.length === 0 ? (
        <section className="mt-8 rounded border border-border bg-surface p-8 text-center">
          <h2 className="text-lg font-bold text-foreground">
            似ている作品が見つかりませんでした
          </h2>
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/works"
              className="inline-flex min-h-11 items-center justify-center rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
            >
              作品一覧から探す
            </Link>
            <Link
              href="/ranking"
              className="inline-flex min-h-11 items-center justify-center rounded border border-accent px-4 py-2 text-sm font-bold text-accent hover:bg-accent-light"
            >
              人気作品を見る
            </Link>
            <Link
              href="/compare"
              className="inline-flex min-h-10 items-center justify-center px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              比較をやめる
            </Link>
          </div>
        </section>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted">
            {paginated.totalItems}件中 {(currentPage - 1) * COMPARE_SELECT_PAGE_SIZE + 1}
            –
            {Math.min(currentPage * COMPARE_SELECT_PAGE_SIZE, paginated.totalItems)}
            件を表示
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.items.map((work) => (
              <SimilarWorkSelectCard
                key={work.contentId}
                work={work}
                anchorContentId={contentId}
                reasonLimit={3}
              />
            ))}
          </div>
          <CompareSelectPagination
            contentId={contentId}
            currentPage={currentPage}
            totalPages={totalPages}
            sort={sort}
          />
        </>
      )}
    </PageLayout>
  );
}
