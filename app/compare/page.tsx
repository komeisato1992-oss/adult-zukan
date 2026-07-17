import { Suspense } from "react";
import { ComparePageClient } from "@/components/compare/ComparePageClient";
import { ComparePageReachTracker } from "@/components/compare/ComparePageReachTracker";
import { CompareRelatedWorksSection } from "@/components/compare/CompareRelatedWorksSection";
import { CompareSingleWorkSuggestions } from "@/components/compare/CompareSingleWorkSuggestions";
import { PageLayout } from "@/components/layout/PageLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getDmmWorkByContentId } from "@/lib/dmm/get-work";
import {
  buildCompareCanonicalPath,
  buildComparePageHref,
  normalizeCompareIds,
  parseCompareIdsParam,
} from "@/lib/compare/urls";
import { createBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { createPageMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/lib/site-config";

type ComparePageProps = {
  searchParams: Promise<{ ids?: string }>;
};

export async function generateMetadata({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const displayIds = parseCompareIdsParam(params.ids);
  const canonicalIds = normalizeCompareIds(displayIds);

  if (canonicalIds.length >= 2) {
    const [workA, workB] = await Promise.all([
      getDmmWorkByContentId(canonicalIds[0]),
      getDmmWorkByContentId(canonicalIds[1]),
    ]);
    const titleA = workA?.title?.trim() || canonicalIds[0];
    const titleB = workB?.title?.trim() || canonicalIds[1];
    const shortA = titleA.length > 28 ? `${titleA.slice(0, 28)}…` : titleA;
    const shortB = titleB.length > 28 ? `${titleB.slice(0, 28)}…` : titleB;

    return createPageMetadata({
      title:
        canonicalIds.length === 2
          ? `${shortA} vs ${shortB} 比較`
          : `${canonicalIds.length}作品比較`,
      description: `「${titleA}」と「${titleB}」を並べて比較。出演女優・価格・ジャンル・作品説明を確認できます。`,
      path: buildComparePageHref(displayIds),
      canonicalPath: buildCompareCanonicalPath(canonicalIds),
      absoluteTitle: true,
    });
  }

  return createPageMetadata({
    title: "作品比較",
    description: "気になる作品を最大4件まで並べて比較できます。",
    path: "/compare",
    canonicalPath: "/compare",
    absoluteTitle: true,
  });
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const displayIds = parseCompareIdsParam(params.ids);
  const relatedIds =
    displayIds.length >= 2 ? displayIds.slice(0, 2) : displayIds;

  const [workA, workB] =
    relatedIds.length >= 2
      ? await Promise.all([
          getDmmWorkByContentId(relatedIds[0]),
          getDmmWorkByContentId(relatedIds[1]),
        ])
      : relatedIds.length === 1
        ? [await getDmmWorkByContentId(relatedIds[0]), null]
        : [null, null];

  const breadcrumbItems = [
    { label: "トップ", href: "/" },
    { label: "作品比較" },
  ];

  const breadcrumbJsonLd = createBreadcrumbJsonLd([
    { name: "トップ", path: "/" },
    { name: "作品比較", path: "/compare" },
  ]);

  return (
    <PageLayout>
      <div className="max-[768px]:pb-[calc(80px+env(safe-area-inset-bottom))]">
      <JsonLd data={breadcrumbJsonLd} />
      <Breadcrumb items={breadcrumbItems} />
      <header className="mt-4 mb-4 max-[768px]:mb-2 max-[768px]:mt-3">
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground max-[768px]:text-xl">
          作品比較
        </h1>
        {displayIds.length >= 2 && workA && workB ? (
          <p className="mt-2 text-sm text-muted max-[768px]:hidden">
            「{workA.title}」と「{workB.title}」
            {displayIds.length > 2
              ? `など${displayIds.length}作品`
              : ""}
            を比較しています。
            {siteConfig.name}で出演情報・価格・ジャンルを並べて確認できます。
          </p>
        ) : null}
      </header>
      <ComparePageReachTracker idsFromUrl={displayIds} />
      <Suspense
        fallback={
          <section className="mt-8 rounded border border-border bg-surface p-8 text-center text-sm text-muted">
            比較作品を読み込み中...
          </section>
        }
      >
        <ComparePageClient />
      </Suspense>

      {displayIds.length === 1 && relatedIds[0] ? (
        <Suspense fallback={null}>
          <CompareSingleWorkSuggestions
            contentId={relatedIds[0]}
            title={workA?.title}
          />
        </Suspense>
      ) : null}

      {relatedIds.length >= 2 ? (
        <Suspense fallback={null}>
          <CompareRelatedWorksSection
            contentIdA={relatedIds[0]}
            contentIdB={relatedIds[1]}
            titleA={workA?.title}
            titleB={workB?.title}
          />
        </Suspense>
      ) : null}
      </div>
    </PageLayout>
  );
}
