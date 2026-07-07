export type ArticleCategory =
  | "recommend"
  | "actress-works"
  | "maker-guide"
  | "series-guide"
  | "genre-guide";

export type Article = {
  slug: string;
  title: string;
  description: string;
  category: ArticleCategory;
  publishedAt: string;
  updatedAt?: string;
  intro: string;
  body: string[];
  relatedPaths?: string[];
};

const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  recommend: "おすすめ",
  "actress-works": "女優出演作品",
  "maker-guide": "メーカー解説",
  "series-guide": "シリーズまとめ",
  "genre-guide": "ジャンルおすすめ",
};

/** CMS化しやすい記事データ。今後 JSON / CMS から読み込み可能 */
const articles: Article[] = [
  {
    slug: "sample-recommend",
    title: "人気作品おすすめ10選",
    description:
      "アダルト図鑑で人気の作品10選を紹介。新作・セール情報もあわせてチェックできます。",
    category: "recommend",
    publishedAt: "2026-01-01",
    intro:
      "アダルト図鑑に掲載されている人気作品から、特におすすめの10作品をピックアップしました。",
    body: [
      "人気作品は日々更新されています。気になる作品があれば詳細ページから出演女優や価格を確認してください。",
      "セール中の作品は作品一覧のセールフィルターからも探せます。",
    ],
    relatedPaths: ["/works", "/works?sale=true"],
  },
];

export function getArticleCategoryLabel(category: ArticleCategory): string {
  return CATEGORY_LABELS[category];
}

export function getAllArticles(): Article[] {
  return [...articles].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}

export function getArticleStaticParams(): { slug: string }[] {
  return articles.map((article) => ({ slug: article.slug }));
}
