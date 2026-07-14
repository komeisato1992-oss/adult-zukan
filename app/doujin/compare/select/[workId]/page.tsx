import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DoujinCardImage } from "@/components/doujin/DoujinCardImage";
import { DoujinCompareSelectPagination } from "@/components/doujin/DoujinCompareSelectPagination";
import { DoujinCompareSelectSortTabs } from "@/components/doujin/DoujinCompareSelectSortTabs";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimilarWorkSelectCard } from "@/components/doujin/DoujinSimilarWorkSelectCard";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SITE_URL } from "@/lib/constants";
import { getDoujinCardImage } from "@/lib/doujin/card-image";
import { getDoujinPublicWorks, getDoujinWorkById } from "@/lib/doujin/catalog";
import { getDoujinSimilarWorks } from "@/lib/doujin/compare/get-similar-works";
import {
  DOUJIN_COMPARE_SELECT_MAX_PAGES,
  DOUJIN_COMPARE_SELECT_PAGE_SIZE,
  DOUJIN_SIMILARITY_SORT_LABELS,
  parseDoujinSimilaritySort,
} from "@/lib/doujin/compare/similarity";
import { buildDoujinCompareSelectHref } from "@/lib/doujin/compare/urls";
import { formatDoujinPrice } from "@/lib/doujin/format";
import { doujinSiteConfig } from "@/lib/doujin/site-config";
import { paginateItems, parsePageParam } from "@/lib/pagination";

type DoujinCompareSelectPageProps = {
  params: Promise<{ workId: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export async function generateMetadata({
  params,
}: DoujinCompareSelectPageProps): Promise<Metadata> {
  const { workId } = await params;
  const work = getDoujinWorkById(workId);
  const titleBase = work?.title
    ? `${work.title}の比較候補`
    : "比較候補の選択";
  const description = work?.title
    ? `「${work.title}」に似ている同人作品から比較対象を選べます。`
    : "似ている同人作品から比較対象を選べます。";
  const path = buildDoujinCompareSelectHref(workId);

  return {
    title: {
      absolute: `${titleBase} | ${doujinSiteConfig.name}`,
    },
    description,
    alternates: {
      canonical: `${SITE_URL}${path}`,
    },
    robots: { index: false, follow: true },
  };
}

export default async function DoujinCompareSelectPage({
  params,
  searchParams,
}: DoujinCompareSelectPageProps) {
  const { workId } = await params;
  const query = await searchParams;
  const sort = parseDoujinSimilaritySort(query.sort);
  const page = parsePageParam(query.page);

  const publicWorks = getDoujinPublicWorks();
  const anchor =
    getDoujinWorkById(workId) ??
    publicWorks.find((work) => work.id === workId) ??
    null;
  if (!anchor) {
    notFound();
  }

  const allCandidates = await getDoujinSimilarWorks(workId, sort);
  const totalPages = Math.min(
    DOUJIN_COMPARE_SELECT_MAX_PAGES,
    Math.max(1, Math.ceil(allCandidates.length / DOUJIN_COMPARE_SELECT_PAGE_SIZE)),
  );
  const currentPage = Math.min(page, totalPages);
  const paginated = paginateItems(
    allCandidates,
    currentPage,
    DOUJIN_COMPARE_SELECT_PAGE_SIZE,
  );

  const imageUrl = getDoujinCardImage(anchor);
  const price = formatDoujinPrice(anchor.price);

  return (
    <DoujinPageLayout showSidebar={false}>
      <div className="max-[768px]:pb-[calc(140px+env(safe-area-inset-bottom))]">
        <Breadcrumb
          items={[
            { label: "同人図鑑", href: "/doujin" },
            { label: "作品比較", href: "/doujin/compare" },
            { label: "比較候補" },
          ]}
        />

        <header className="mt-4 mb-4">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            比較する作品を選ぶ
          </h1>
          <p className="mt-2 text-sm text-muted">
            {DOUJIN_SIMILARITY_SORT_LABELS[sort]}
            の候補から、比較する2作品目を選んでください。
          </p>
        </header>

        <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-muted">比較元の作品</h2>
          <div className="mt-3 flex gap-4">
            <Link
              href={`/doujin/works/${anchor.id}`}
              className="doujin-work-card__image-wrapper relative block w-24 shrink-0 overflow-hidden rounded border border-border sm:w-28"
            >
              {imageUrl ? (
                <DoujinCardImage src={imageUrl} alt={anchor.title} sizes="112px" />
              ) : (
                <div className="flex aspect-[2/3] items-center justify-center bg-surface text-xs text-muted">
                  画像なし
                </div>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/doujin/works/${anchor.id}`}
                className="line-clamp-2 text-base font-bold text-foreground hover:text-accent"
              >
                {anchor.title}
              </Link>
              {anchor.circleName || (anchor.circleNames?.length ?? 0) > 0 ? (
                <p className="mt-1 line-clamp-1 text-sm text-muted">
                  {anchor.circleName ?? anchor.circleNames?.[0]}
                </p>
              ) : null}
              {(anchor.authorNames ?? []).length > 0 ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                  {(anchor.authorNames ?? []).slice(0, 3).join("、")}
                </p>
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

        <DoujinCompareSelectSortTabs workId={workId} currentSort={sort} />

        {paginated.items.length === 0 ? (
          <section className="mt-8 rounded border border-border bg-surface p-8 text-center">
            <h2 className="text-lg font-bold text-foreground">
              似ている作品が見つかりませんでした
            </h2>
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/doujin/works"
                className="inline-flex min-h-11 items-center justify-center rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
              >
                作品一覧から探す
              </Link>
              <Link
                href="/doujin/ranking"
                className="inline-flex min-h-11 items-center justify-center rounded border border-accent px-4 py-2 text-sm font-bold text-accent hover:bg-accent-light"
              >
                人気作品を見る
              </Link>
              <Link
                href="/doujin/compare"
                className="inline-flex min-h-10 items-center justify-center px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                比較をやめる
              </Link>
            </div>
          </section>
        ) : (
          <>
            <p className="mt-3 text-xs text-muted">
              {paginated.totalItems}件中{" "}
              {(currentPage - 1) * DOUJIN_COMPARE_SELECT_PAGE_SIZE + 1}–
              {Math.min(
                currentPage * DOUJIN_COMPARE_SELECT_PAGE_SIZE,
                paginated.totalItems,
              )}
              件を表示
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 min-[769px]:grid-cols-2 min-[769px]:gap-4 lg:grid-cols-3">
              {paginated.items.map((work) => (
                <DoujinSimilarWorkSelectCard
                  key={work.workId}
                  work={work}
                  anchorWorkId={workId}
                  reasonLimit={3}
                />
              ))}
            </div>
            <DoujinCompareSelectPagination
              workId={workId}
              currentPage={currentPage}
              totalPages={totalPages}
              sort={sort}
            />
          </>
        )}
      </div>
    </DoujinPageLayout>
  );
}
