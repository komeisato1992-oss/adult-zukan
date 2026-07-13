import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DoujinEmptyState } from "@/components/doujin/DoujinEmptyState";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSearchBar } from "@/components/doujin/DoujinSearchBar";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { DoujinWorksGrid } from "@/components/doujin/DoujinWorksGrid";
import {
  hasDoujinCatalogData,
  searchDoujinAuthors,
  searchDoujinCatalog,
} from "@/lib/doujin/catalog";
import { DOUJIN_PLACEHOLDER_IMAGE } from "@/lib/doujin/format";
import { doujinPageIntros } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: "検索",
  description: doujinPageIntros.search,
  robots: { index: false, follow: false, nocache: true },
};

type DoujinSearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function DoujinSearchPage({
  searchParams,
}: DoujinSearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const hasData = hasDoujinCatalogData();
  const works = hasData ? searchDoujinCatalog(query) : [];
  const authors =
    hasData && query ? searchDoujinAuthors(query) : [];

  return (
    <DoujinPageLayout>
      <DoujinSimplePage title="検索" description={doujinPageIntros.search}>
        <DoujinSearchBar defaultValue={query} />
        {!hasData ? (
          <div className="mt-6">
            <DoujinEmptyState />
          </div>
        ) : (
          <>
            {authors.length > 0 ? (
              <section className="mt-8" aria-labelledby="doujin-author-results">
                <h2
                  id="doujin-author-results"
                  className="mb-3 text-base font-bold text-foreground"
                >
                  作者
                </h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {authors.map((author) => (
                    <li key={author.id}>
                      <Link
                        href={`/doujin/authors/${author.id}`}
                        className="block overflow-hidden rounded-lg border border-border bg-white transition-colors hover:border-accent"
                      >
                        <div className="doujin-author-card__image-wrapper">
                          <Image
                            src={
                              author.representativeWork?.imageUrl ||
                              DOUJIN_PLACEHOLDER_IMAGE
                            }
                            alt={`${author.name}の代表作品`}
                            fill
                            className="doujin-author-card__image"
                            sizes="25vw"
                            unoptimized
                          />
                        </div>
                        <div className="px-3 py-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {author.name}
                          </p>
                          <p className="text-xs text-muted">
                            {author.workCount}作品
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <p className="mt-6 text-sm text-muted">
              {query
                ? `「${query}」の作品検索結果: ${works.length}件`
                : `全${works.length}件を表示中`}
            </p>
            <div className="mt-4">
              <DoujinWorksGrid works={works} />
            </div>
          </>
        )}
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
