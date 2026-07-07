import Link from "next/link";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageIntro } from "@/components/ui/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getAllArticles,
  getArticleCategoryLabel,
} from "@/data/articles";
import { siteConfig } from "@/lib/site-config";
import { createPageMetadata } from "@/lib/seo/metadata";
import { truncateDescription } from "@/lib/seo/descriptions";
import { seoTitles } from "@/lib/seo/titles";
import {
  createBreadcrumbJsonLd,
  createCollectionPageJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

const articlesIntro =
  "おすすめ作品・女優出演作品・メーカー解説・シリーズまとめ・ジャンルおすすめなどの記事を掲載予定です。今後順次追加していきます。";

export const metadata = createPageMetadata({
  title: seoTitles.articles,
  description: truncateDescription(articlesIntro),
  path: "/articles",
  absoluteTitle: true,
});

export default function ArticlesPage() {
  const articles = getAllArticles();

  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbJsonLd([
            { name: "トップ", path: "/" },
            { name: "記事一覧", path: "/articles" },
          ]),
          createCollectionPageJsonLd(
            "記事一覧",
            articlesIntro,
            `${siteConfig.url}/articles`,
          ),
        ]}
      />
      <PageLayout>
        <Breadcrumb
          items={[{ label: "トップ", href: "/" }, { label: "記事一覧" }]}
        />
        <header className="mt-4 mb-6">
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            記事一覧
          </h1>
          <PageIntro text={articlesIntro} />
        </header>

        <div className="grid gap-4">
          {articles.map((article) => (
            <article
              key={article.slug}
              className="rounded border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-xs text-muted">
                {getArticleCategoryLabel(article.category)}
              </p>
              <h2 className="mt-1 text-lg font-bold text-foreground">
                <Link
                  href={`/articles/${article.slug}`}
                  className="hover:text-accent"
                >
                  {article.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm text-muted">{article.description}</p>
            </article>
          ))}
        </div>
      </PageLayout>
    </>
  );
}
