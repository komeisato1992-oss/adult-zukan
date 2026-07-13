import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { DoujinWorksGrid } from "@/components/doujin/DoujinWorksGrid";
import { Pagination } from "@/components/ui/Pagination";
import { getRepresentativeWorkForAuthor } from "@/lib/doujin/author-representative";
import {
  DOUJIN_AUTHOR_WORK_SORT_OPTIONS,
  parseDoujinAuthorLimitParam,
  parseDoujinAuthorWorkSortParam,
} from "@/lib/doujin/author-list";
import { sortAuthorWorks } from "@/lib/doujin/author-list-data";
import {
  getDoujinAuthorById,
  getDoujinWorksByAuthorId,
} from "@/lib/doujin/catalog";
import { DOUJIN_PLACEHOLDER_IMAGE } from "@/lib/doujin/format";
import { paginateItems, parsePageParam } from "@/lib/pagination";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string; perPage?: string; page?: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const author = getDoujinAuthorById(id);
  return {
    title: author ? author.name : "作者詳細",
    robots: { index: false, follow: false, nocache: true, noarchive: true },
  };
}

export default async function DoujinAuthorDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const author = getDoujinAuthorById(id);
  if (!author) notFound();

  const sort = parseDoujinAuthorWorkSortParam(query.sort);
  const perPage = parseDoujinAuthorLimitParam(query.perPage);
  const page = parsePageParam(query.page);
  const allWorks = sortAuthorWorks(getDoujinWorksByAuthorId(id), sort);
  const paginated = paginateItems(allWorks, page, perPage);
  const representative = getRepresentativeWorkForAuthor(allWorks);
  const imageUrl = representative?.imageUrl || DOUJIN_PLACEHOLDER_IMAGE;

  return (
    <DoujinPageLayout>
      <DoujinSimplePage
        title={author.name}
        description={`作者「${author.name}」の同人作品一覧です。`}
        breadcrumbs={[
          { href: "/doujin", label: "同人図鑑" },
          { href: "/doujin/authors", label: "作者一覧" },
          { label: author.name },
        ]}
      >
        <div className="mb-8 grid gap-6 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-start">
          <div className="doujin-author-card__image-wrapper overflow-hidden rounded-lg">
            <Image
              src={imageUrl}
              alt={`${author.name}の代表作品`}
              fill
              sizes="(max-width: 640px) 100vw, 16rem"
              className="doujin-author-card__image"
              unoptimized
            />
          </div>
          <div>
            <p className="text-sm text-muted">
              作品数 {allWorks.length.toLocaleString("ja-JP")}作品
            </p>
            {representative ? (
              <p className="mt-2 text-sm text-foreground">
                代表作品:{" "}
                <Link
                  href={`/doujin/works/${representative.id}`}
                  className="font-medium text-accent hover:underline"
                >
                  {representative.title}
                </Link>
              </p>
            ) : null}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {DOUJIN_AUTHOR_WORK_SORT_OPTIONS.map((option) => (
            <Link
              key={option.key}
              href={`/doujin/authors/${id}?sort=${option.key}&perPage=${perPage}`}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                sort === option.key
                  ? "border-accent bg-accent-light text-accent"
                  : "border-border bg-white text-foreground hover:border-accent hover:text-accent"
              }`}
              scroll
            >
              {option.label}
            </Link>
          ))}
        </div>

        {paginated.items.length > 0 ? (
          <>
            <DoujinWorksGrid works={paginated.items} />
            <Pagination
              currentPage={paginated.currentPage}
              totalPages={paginated.totalPages}
              basePath={`/doujin/authors/${id}`}
              query={{
                sort: sort === "new" ? undefined : sort,
                perPage: perPage === 20 ? undefined : String(perPage),
              }}
            />
          </>
        ) : (
          <p className="text-sm text-muted">この作者の作品はまだありません。</p>
        )}
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
