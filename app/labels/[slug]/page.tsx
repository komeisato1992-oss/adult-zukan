import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PaginatedWorkListSection } from "@/components/works/PaginatedWorkListSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBuildStaticGenerationLimit } from "@/lib/dmm/build-static";
import { getLimitedEncodedEntityStaticParams } from "@/lib/dmm/generate-static-params";
import { getLabelSummaryBySlug, getLabelWorksBySlug, getCatalogOrderMap } from "@/lib/catalog";
import { parsePageParam } from "@/lib/pagination";
import { getPaginatedDisplayableWorkCardList } from "@/lib/works/paginated-work-list";
import { parseWorkSortParam } from "@/lib/works/sort";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createListDescription } from "@/lib/seo/descriptions";
import { createLabelTitle } from "@/lib/seo/titles";
import { decodeEntitySlug, getLabelDetailPath, getMakerDetailPath } from "@/lib/entities/paths";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

/**
 * searchParams（page/sort）を使うエンティティ詳細は ISR だと
 * production で DYNAMIC_SERVER_USAGE → 500 になるため動的描画を強制する。
 * （90cfb7c の修正。コスト削減で外したところ再発した）
 */
export const dynamic = "force-dynamic";

export const dynamicParams = true;

type LabelDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
};

export async function generateStaticParams() {
  if (getBuildStaticGenerationLimit() === 0) return [];
  const { getLabelSummaries } = await import("@/lib/catalog");
  const labels = await getLabelSummaries();
  return getLimitedEncodedEntityStaticParams(labels.map((l) => l.slug));
}

export async function generateMetadata({
  params,
  searchParams,
}: LabelDetailPageProps) {
  await searchParams;
  const { slug: rawSlug } = await params;
  const slug = decodeEntitySlug(rawSlug);
  const label = await getLabelSummaryBySlug(slug);

  if (!label) {
    return createPageMetadata({
      title: "レーベルが見つかりません",
      description: "指定されたレーベルは見つかりませんでした。",
      path: getLabelDetailPath(rawSlug),
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: createLabelTitle(label.name),
    description: createListDescription({
      name: label.name,
      count: label.workCount,
      context: "レーベルの作品一覧",
    }),
    path: getLabelDetailPath(label.slug),
    absoluteTitle: true,
  });
}

export default async function LabelDetailPage({
  params,
  searchParams,
}: LabelDetailPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeEntitySlug(rawSlug);
  const { page, sort } = await searchParams;
  const label = await getLabelSummaryBySlug(slug);

  if (!label) {
    notFound();
  }

  const works = await getLabelWorksBySlug(slug);
  const currentSort = parseWorkSortParam(sort);
  const catalogOrder = await getCatalogOrderMap();
  const list = getPaginatedDisplayableWorkCardList(works, {
    page: parsePageParam(page),
    sort: currentSort,
    catalogOrder,
  });

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "レーベル一覧", path: "/labels" },
            { name: label.name, path: getLabelDetailPath(label.slug) },
          ]),
          createCollectionPageJsonLd(
            `${label.name}レーベルの作品一覧`,
            `${label.name}レーベルの作品一覧`,
            `${siteConfig.url}${getLabelDetailPath(label.slug)}`,
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "レーベル一覧", href: "/labels" },
            { label: label.name },
          ]}
        />
        <header className="mt-4 mb-6">
          {label.makerName && label.makerSlug && (
            <p className="text-sm text-muted">
              メーカー:{" "}
              <Link
                href={getMakerDetailPath(label.makerSlug)}
                className="text-accent hover:underline"
              >
                {label.makerName}
              </Link>
            </p>
          )}
          <h1 className="mt-2 border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {label.name}
          </h1>
          <p className="mt-2 text-sm text-muted">{label.workCount}件の作品</p>
        </header>

        <section aria-labelledby="label-all">
          <SectionHeader title="全作品" id="label-all" />
          {list.totalItems > 0 ? (
            <PaginatedWorkListSection
              pageItems={list.pageItems}
              currentPage={list.currentPage}
              totalPages={list.totalPages}
              basePath={getLabelDetailPath(slug)}
              currentSort={currentSort}
            />
          ) : (
            <div className="rounded border border-border bg-surface p-8 text-center">
              <p className="text-sm text-muted">
                現在表示できる作品がありません
              </p>
              <nav
                aria-label="関連ページ"
                className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm"
              >
                <Link href="/works" className="text-accent hover:underline">
                  作品一覧
                </Link>
                <Link href="/ranking" className="text-accent hover:underline">
                  人気作品
                </Link>
                <Link href="/genres" className="text-accent hover:underline">
                  ジャンル一覧
                </Link>
                <Link href="/search" className="text-accent hover:underline">
                  検索
                </Link>
              </nav>
            </div>
          )}
        </section>
      </PageLayout>
    </>
  );
}
