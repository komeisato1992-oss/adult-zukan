import { Suspense } from "react";
import type { Metadata } from "next";
import { DoujinComparePageClient } from "@/components/doujin/DoujinComparePageClient";
import { DoujinComparePageReachTracker } from "@/components/doujin/DoujinComparePageReachTracker";
import { DoujinCompareRelatedWorksSection } from "@/components/doujin/DoujinCompareRelatedWorksSection";
import { DoujinCompareSingleWorkSuggestions } from "@/components/doujin/DoujinCompareSingleWorkSuggestions";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SITE_URL } from "@/lib/constants";
import { getDoujinWorkById } from "@/lib/doujin/catalog";
import {
  buildDoujinCompareCanonicalPath,
  buildDoujinComparePageHref,
  normalizeDoujinCompareIds,
  parseDoujinCompareIdsParam,
} from "@/lib/doujin/compare/urls";
import { doujinPageIntros, doujinSiteConfig } from "@/lib/doujin/site-config";

type DoujinComparePageProps = {
  searchParams: Promise<{ ids?: string }>;
};

export async function generateMetadata({
  searchParams,
}: DoujinComparePageProps): Promise<Metadata> {
  const params = await searchParams;
  const displayIds = parseDoujinCompareIdsParam(params.ids);
  const canonicalIds = normalizeDoujinCompareIds(displayIds);
  const count = canonicalIds.length;

  if (count === 2) {
    const [workA, workB] = [
      getDoujinWorkById(canonicalIds[0]),
      getDoujinWorkById(canonicalIds[1]),
    ];
    const titleA = workA?.title?.trim() || canonicalIds[0];
    const titleB = workB?.title?.trim() || canonicalIds[1];
    const shortA = titleA.length > 28 ? `${titleA.slice(0, 28)}…` : titleA;
    const shortB = titleB.length > 28 ? `${titleB.slice(0, 28)}…` : titleB;
    const canonicalPath = buildDoujinCompareCanonicalPath(canonicalIds);

    return {
      title: {
        absolute: `${shortA} vs ${shortB} 比較 | ${doujinSiteConfig.name}`,
      },
      description: `「${titleA}」と「${titleB}」を並べて比較。価格・サークル・作者・ジャンルを確認できます。`,
      alternates: {
        canonical: `${SITE_URL}${canonicalPath}`,
      },
      robots: { index: true, follow: true },
    };
  }

  const path =
    count >= 1 ? buildDoujinComparePageHref(displayIds) : "/doujin/compare";
  const title =
    count >= 3
      ? `${count}作品比較`
      : count === 1
        ? "作品比較"
        : "同人作品比較";

  return {
    title: {
      absolute: `${title} | ${doujinSiteConfig.name}`,
    },
    description: doujinPageIntros.compare,
    alternates: {
      canonical: `${SITE_URL}${count === 0 ? "/doujin/compare" : path}`,
    },
    robots: { index: false, follow: true },
  };
}

export default async function DoujinComparePage({
  searchParams,
}: DoujinComparePageProps) {
  const params = await searchParams;
  const displayIds = parseDoujinCompareIdsParam(params.ids);

  const workA =
    displayIds.length >= 1 ? getDoujinWorkById(displayIds[0]) : null;
  const workB =
    displayIds.length >= 2 ? getDoujinWorkById(displayIds[1]) : null;

  return (
    <DoujinPageLayout showSidebar={false}>
      <div className="max-[768px]:pb-[calc(140px+env(safe-area-inset-bottom))]">
        <Breadcrumb
          items={[
            { label: "同人図鑑", href: "/doujin" },
            { label: "作品比較" },
          ]}
        />
        <header className="mt-4 mb-4 max-[768px]:mb-2 max-[768px]:mt-3">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground max-[768px]:text-xl">
            同人作品比較
          </h1>
          {displayIds.length >= 2 && workA && workB ? (
            <p className="mt-2 text-sm text-muted max-[768px]:hidden">
              「{workA.title}」と「{workB.title}」
              {displayIds.length > 2
                ? `など${displayIds.length}作品`
                : ""}
              を比較しています。
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted max-[768px]:hidden">
              {doujinPageIntros.compare}
            </p>
          )}
        </header>

        <DoujinComparePageReachTracker idsFromUrl={displayIds} />

        <Suspense
          fallback={
            <section className="mt-8 rounded border border-border bg-surface p-8 text-center text-sm text-muted">
              比較作品を読み込み中...
            </section>
          }
        >
          <DoujinComparePageClient />
        </Suspense>

        {displayIds.length === 1 && displayIds[0] ? (
          <Suspense fallback={null}>
            <DoujinCompareSingleWorkSuggestions
              workId={displayIds[0]}
              title={workA?.title}
            />
          </Suspense>
        ) : null}

        {displayIds.length >= 2 ? (
          <Suspense fallback={null}>
            <DoujinCompareRelatedWorksSection
              workIds={displayIds}
              titleA={workA?.title}
              titleB={workB?.title}
            />
          </Suspense>
        ) : null}
      </div>
    </DoujinPageLayout>
  );
}
