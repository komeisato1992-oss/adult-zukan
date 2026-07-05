import type { Work } from "@/data/types";
import type { DmmItem } from "@/lib/dmm/types";
import {
  formatReleaseDate,
  parseDmmPrice,
  slugify,
} from "@/lib/utils";

function buildRankingScore(item: DmmItem, index: number): number {
  const reviewAverage = parseFloat(item.review?.average ?? "0");
  const reviewCount = item.review?.count ?? 0;

  if (reviewAverage > 0 || reviewCount > 0) {
    return Math.round(reviewAverage * 100 + Math.min(reviewCount, 500));
  }

  return Math.max(100, 1000 - index);
}

export function mapDmmItemToWork(item: DmmItem, index = 0): Work {
  const price = parseDmmPrice(item.prices?.price);
  const listPrice = parseDmmPrice(item.prices?.list_price);
  const hasSale = listPrice > 0 && price > 0 && price < listPrice;

  const genres = item.iteminfo?.genre ?? [];
  const actresses = item.iteminfo?.actress ?? [];
  const maker = item.iteminfo?.maker?.[0];

  const genreNames = genres.map((genre) => genre.name);
  const actressNames = actresses.map((actress) => actress.name);
  const makerName = maker?.name ?? "不明";
  const makerSlug = slugify(makerName);

  const imageUrl =
    item.imageURL?.large ??
    item.imageURL?.list ??
    item.imageURL?.small ??
    "";

  const description =
    genreNames.length > 0
      ? `${genreNames.slice(0, 3).join(" / ")}の作品。${makerName}より配信。`
      : `${makerName}より配信されている作品です。`;

  const rankingScore = buildRankingScore(item, index);

  return {
    slug: item.content_id,
    contentId: item.content_id,
    productId: item.product_id,
    title: item.title,
    description,
    longDescription: description,
    recommendPoints: [],
    productCode: item.content_id,
    releaseDate: formatReleaseDate(item.date),
    price: hasSale ? listPrice : price,
    salePrice: hasSale ? price : undefined,
    duration: 0,
    makerSlug,
    makerName,
    labelSlug: makerSlug,
    labelName: makerName,
    seriesSlug: makerSlug,
    seriesName: `${makerName}作品`,
    genreSlugs: genreNames.map((name) => slugify(name)),
    genreNames,
    actressSlugs: actressNames.map((name) => slugify(name)),
    actressNames,
    relatedWorkSlugs: [],
    imageUrl,
    affiliateUrl: item.affiliateURL || item.URL,
    affiliateProvider: "fanza",
    rankingScore,
    weeklyScore: rankingScore,
    monthlyScore: rankingScore,
    source: "api",
  };
}

export function mapDmmItemsToWorks(items: DmmItem[]): Work[] {
  return items.map((item, index) => mapDmmItemToWork(item, index));
}
