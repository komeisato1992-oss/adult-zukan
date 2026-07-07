import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getArticleBySlug,
  getArticleCategoryLabel,
  getArticleStaticParams,
} from "@/data/articles";
import { createPageMetadata } from "@/lib/seo/metadata";
import { truncateDescription } from "@/lib/seo/descriptions";
import { createArticleTitle } from "@/lib/seo/titles";
import {
  createArticleJsonLd,
  createBreadcrumbJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

type ArticleDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getArticleStaticParams();
}

export async function generateMetadata({ params }: ArticleDetailPageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return createPageMetadata({
      title: "記事が見つかりません",
      description: "指定された記事は見つかりませんでした。",
      path: `/articles/${slug}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: createArticleTitle(article.title),
    description: truncateDescription(article.description),
    path: `/articles/${article.slug}`,
    ogType: "article",
    absoluteTitle: true,
  });
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "記事一覧", path: "/articles" },
            { name: article.title, path: `/articles/${article.slug}` },
          ]),
          createArticleJsonLd({
            title: article.title,
            description: article.description,
            path: `/articles/${article.slug}`,
            publishedAt: article.publishedAt,
            updatedAt: article.updatedAt,
          }),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[
            { label: "トップ", href: "/" },
            { label: "記事一覧", href: "/articles" },
            { label: article.title },
          ]}
        />

        <article className="mt-6">
          <header className="mb-8">
            <p className="text-xs text-muted">
              {getArticleCategoryLabel(article.category)}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
              {article.title}
            </h1>
            <PageIntro text={article.intro} />
          </header>

          <div className="space-y-4 text-sm leading-relaxed text-muted sm:text-base">
            {article.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {article.relatedPaths && article.relatedPaths.length > 0 ? (
            <section aria-labelledby="article-related" className="mt-10">
              <h2
                id="article-related"
                className="mb-4 border-l-4 border-accent pl-3 text-lg font-bold text-foreground"
              >
                関連リンク
              </h2>
              <ul className="space-y-2">
                {article.relatedPaths.map((href) => (
                  <li key={href}>
                    <Link href={href} className="text-accent hover:underline">
                      {href}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      </PageLayout>
    </>
  );
}
