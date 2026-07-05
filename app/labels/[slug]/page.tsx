import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { WorkCard } from "@/components/ui/WorkCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllLabels, getLabelBySlug } from "@/data/labels";
import { getWorksByLabel } from "@/lib/works/repository";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  createBreadcrumbJsonLd,
  createItemListJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

type LabelDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllLabels().map((label) => ({ slug: label.slug }));
}

export async function generateMetadata({ params }: LabelDetailPageProps) {
  const { slug } = await params;
  const label = getLabelBySlug(slug);

  if (!label) {
    return createPageMetadata({
      title: "レーベルが見つかりません",
      description: "指定されたレーベルは見つかりませんでした。",
      path: `/labels/${slug}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: `${label.name}レーベルの作品一覧`,
    description: label.longDescription.slice(0, 120),
    path: `/labels/${label.slug}`,
  });
}

export default async function LabelDetailPage({ params }: LabelDetailPageProps) {
  const { slug } = await params;
  const label = getLabelBySlug(slug);

  if (!label) {
    notFound();
  }

  const works = await getWorksByLabel(label.slug);
  const popularWorks = [...works]
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, 8);

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "レーベル一覧", path: "/labels" },
            { name: label.name, path: `/labels/${label.slug}` },
          ]),
          createItemListJsonLd(
            `${label.name}レーベルの作品一覧`,
            works.map((work) => ({
              name: work.title,
              url: `${siteConfig.url}/works/${work.slug}`,
            })),
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
          <p className="text-sm text-muted">
            メーカー:{" "}
            <Link href={`/makers/${label.makerSlug}`} className="text-accent hover:underline">
              {label.makerName}
            </Link>
          </p>
          <h1 className="mt-2 border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            {label.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            {label.longDescription}
          </p>
          <p className="mt-2 text-sm text-muted">{works.length}件の作品</p>
        </header>

        {popularWorks.length > 0 && (
          <section aria-labelledby="label-popular" className="mb-10">
            <SectionHeader title="人気作品" id="label-popular" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {popularWorks.map((work) => (
                <WorkCard key={work.slug} work={work} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="label-all">
          <SectionHeader title="全作品" id="label-all" />
          {works.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {works.map((work) => (
                <WorkCard key={work.slug} work={work} />
              ))}
            </div>
          ) : (
            <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
              現在、このレーベルの作品はありません。
            </p>
          )}
        </section>
      </PageLayout>
    </>
  );
}
