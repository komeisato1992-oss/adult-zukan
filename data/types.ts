/** アフィリエイト提供元 */
export type AffiliateProvider = "dmm" | "fanza" | "rakuten" | "sample";

export type WorkSource = "api" | "fallback";

export type RelatedArticle = {
  title: string;
  href: string;
  description: string;
};

export type Work = {
  slug: string;
  contentId: string;
  productId: string;
  title: string;
  description: string;
  longDescription: string;
  recommendPoints: string[];
  productCode: string;
  releaseDate: string;
  price: number;
  salePrice?: number;
  duration: number;
  makerSlug: string;
  makerName: string;
  labelSlug: string;
  labelName: string;
  seriesSlug: string;
  seriesName: string;
  genreSlugs: string[];
  genreNames: string[];
  actressSlugs: string[];
  actressNames: string[];
  relatedWorkSlugs: string[];
  imageUrl: string;
  affiliateUrl: string;
  affiliateProvider: AffiliateProvider;
  rankingScore: number;
  weeklyScore: number;
  monthlyScore: number;
  source: WorkSource;
};

export type Genre = {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
};

export type Maker = {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  labelSlugs: string[];
};

export type Label = {
  slug: string;
  name: string;
  makerSlug: string;
  makerName: string;
  description: string;
  longDescription: string;
};

export type Series = {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  makerSlug: string;
  makerName: string;
  genreSlugs: string[];
};

export type Actress = {
  slug: string;
  name: string;
  description: string;
  profile: string;
  debutYear: number;
  imageUrl: string;
  rankingScore: number;
  representativeSeriesSlugs: string[];
  relatedActressSlugs: string[];
  relatedArticles: RelatedArticle[];
};

export type Campaign = {
  id: string;
  title: string;
  description: string;
  href: string;
  badge: string;
};
