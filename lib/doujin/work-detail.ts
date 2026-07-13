import "server-only";

import { getRepresentativeWorkForAuthor } from "@/lib/doujin/author-representative";
import type { DoujinRepresentativeWork } from "@/lib/doujin/author-representative";
import {
  getDoujinAuthorCommentById,
  getDoujinPublicWorks,
  sortDoujinWorks,
} from "@/lib/doujin/catalog";
import {
  formatDoujinPrice,
  getDoujinDiscountPercent,
} from "@/lib/doujin/format";
import {
  getDoujinProductFormatLabel,
  isDoujinProductFormat,
  normalizeDoujinProductFormat,
  type DoujinProductFormat,
} from "@/lib/doujin/product-format";
import { stripHtmlTags } from "@/lib/dmm/description";
import type { DoujinWork } from "@/lib/doujin/types";

export const DOUJIN_DETAIL_SECTION_LIMIT = 8;

export type DoujinInfoLink = {
  label: string;
  href: string;
};

export type DoujinInfoRow = {
  label: string;
  value?: string;
  links?: DoujinInfoLink[];
  multiline?: boolean;
  /** 価格行（赤字） / 通常価格行（取り消し線） */
  valueTone?: "price" | "original";
  /** 価格右側の割引率など */
  trailing?: string;
  /** 作品形式バッジ用キー */
  productFormat?: DoujinProductFormat;
};

export type DoujinWorkAuthorSummary = {
  id: string;
  name: string;
  workCount: number;
  representativeWork: DoujinRepresentativeWork | null;
};

export type DoujinWorkDetailSections = {
  authors: DoujinWorkAuthorSummary[];
  sameCircle: DoujinWork[];
  sameSeries: DoujinWork[];
  sameGenre: DoujinWork[];
  related: DoujinWork[];
  popular: DoujinWork[];
  newest: DoujinWork[];
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPresentNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** カード表示に不要な巨大フィールドを落とす */
export function toDoujinCardWork(work: DoujinWork): DoujinWork {
  return {
    id: work.id,
    contentId: work.contentId,
    title: work.title,
    imageUrl: work.imageUrl,
    imageListUrl: work.imageListUrl,
    imageLargeUrl: work.imageLargeUrl,
    affiliateUrl: work.affiliateUrl,
    circleId: work.circleId,
    circleName: work.circleName,
    circleIds: work.circleIds,
    circleNames: work.circleNames,
    authorIds: work.authorIds,
    authorNames: work.authorNames,
    seriesId: work.seriesId,
    seriesName: work.seriesName,
    genreIds: work.genreIds,
    genreNames: work.genreNames,
    price: work.price,
    originalPrice: work.originalPrice,
    isSale: work.isSale,
    saleEndAt: work.saleEndAt,
    releaseDate: work.releaseDate,
    rating: work.rating,
    reviewCount: work.reviewCount,
    productFormat: work.productFormat,
    productFormatNormalized: work.productFormatNormalized,
    discountRate: work.discountRate,
    initialPopularRank: work.initialPopularRank,
    currentPopularRank: work.currentPopularRank,
    newImportRank: work.newImportRank,
  };
}

export function sanitizeDoujinDescription(
  description?: string | null,
): string | undefined {
  if (!hasText(description)) return undefined;
  const cleaned = stripHtmlTags(description);
  return cleaned || undefined;
}

/**
 * 詳細ページ用：作者コメントと作品紹介の重複を避けて返す。
 * 同一文なら上部の作者コメントのみ表示し、下部の作品紹介は出さない。
 */
export function resolveDoujinCommentDisplay(work: {
  id: string;
  description?: string;
}): {
  authorComment?: string;
  introduction?: string;
} {
  const fromStored = getDoujinAuthorCommentById(work.id);
  const fromDescription = sanitizeDoujinDescription(work.description);
  const authorComment = fromStored ?? fromDescription;
  if (!authorComment) {
    return {};
  }

  const introduction =
    fromDescription && fromDescription !== authorComment
      ? fromDescription
      : undefined;

  return { authorComment, introduction };
}

/** タイトル下の短い抜粋（80〜150文字程度） */
export function getDoujinDescriptionTeaser(
  description: string,
  maxLength = 120,
): string {
  const singleLine = description.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 1)}…`;
}

/**
 * description がないときの短い説明文。
 * 取得済みデータだけから事実ベースで生成する。
 */
export function buildDoujinWorkFallbackTeaser(work: DoujinWork): string {
  const parts: string[] = [];
  if (work.price != null) parts.push("価格");
  if (work.circleName || (work.circleNames?.length ?? 0) > 0) parts.push("サークル");
  if ((work.authorNames?.length ?? 0) > 0) parts.push("作者");
  if (work.seriesName) parts.push("シリーズ");
  if ((work.genreNames?.length ?? 0) > 0) parts.push("ジャンル");
  if (work.rating != null) parts.push("評価");
  if ((work.sampleImageUrls?.length ?? 0) > 0) parts.push("サンプル画像");

  if (parts.length === 0) {
    return `「${work.title}」の作品情報を掲載しています。`;
  }

  return `「${work.title}」の${parts.join("、")}を掲載しています。`;
}

export function getDoujinWorkPageTeaser(work: DoujinWork): string {
  const description = sanitizeDoujinDescription(work.description);
  if (description) return getDoujinDescriptionTeaser(description);
  return buildDoujinWorkFallbackTeaser(work);
}

export function getDoujinWorkMetadataDescription(work: DoujinWork): string {
  return buildDoujinWorkFallbackTeaser(work);
}

function formatUpdatedAt(value?: string): string | undefined {
  if (!hasText(value)) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.trim();
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function circleLinks(work: DoujinWork): DoujinInfoLink[] {
  const ids = work.circleIds?.length
    ? work.circleIds
    : work.circleId
      ? [work.circleId]
      : [];
  const names = work.circleNames?.length
    ? work.circleNames
    : work.circleName
      ? [work.circleName]
      : [];

  return names
    .map((name, index) => {
      const id = ids[index];
      if (!hasText(name) || !hasText(id)) return null;
      return { label: name, href: `/doujin/circles/${id}` };
    })
    .filter((link): link is DoujinInfoLink => Boolean(link));
}

function authorLinks(work: DoujinWork): DoujinInfoLink[] {
  const names = work.authorNames ?? [];
  const ids = work.authorIds ?? [];
  return names
    .map((name, index) => {
      const id = ids[index];
      if (!hasText(name) || !hasText(id)) return null;
      return { label: name, href: `/doujin/authors/${id}` };
    })
    .filter((link): link is DoujinInfoLink => Boolean(link));
}

function genreLinks(work: DoujinWork): DoujinInfoLink[] {
  const names = work.genreNames ?? [];
  const ids = work.genreIds ?? [];
  return names
    .map((name, index) => {
      const id = ids[index];
      if (!hasText(name) || !hasText(id)) return null;
      return { label: name, href: `/doujin/genres/${id}` };
    })
    .filter((link): link is DoujinInfoLink => Boolean(link));
}

export function getDoujinWorkInfoRows(work: DoujinWork): DoujinInfoRow[] {
  const price = formatDoujinPrice(work.price);
  const original =
    work.isSale &&
    work.originalPrice != null &&
    work.price != null &&
    work.originalPrice > work.price
      ? formatDoujinPrice(work.originalPrice)
      : undefined;
  const discount = getDoujinDiscountPercent(work);
  const circles = circleLinks(work);
  const authors = authorLinks(work);
  const genres = genreLinks(work);

  const rows: Array<DoujinInfoRow | null> = [
    hasText(work.contentId) ? { label: "商品ID", value: work.contentId } : null,
    { label: "作品名", value: work.title },
    circles.length > 0
      ? { label: "サークル", links: circles }
      : hasText(work.circleName)
        ? { label: "サークル", value: work.circleName }
        : null,
    authors.length > 0
      ? { label: "作者", links: authors }
      : (work.authorNames?.length ?? 0) > 0
        ? { label: "作者", value: (work.authorNames ?? []).join("、") }
        : null,
    work.seriesId && hasText(work.seriesName)
      ? {
          label: "シリーズ",
          links: [
            {
              label: work.seriesName,
              href: `/doujin/series/${work.seriesId}`,
            },
          ],
        }
      : hasText(work.seriesName)
        ? { label: "シリーズ", value: work.seriesName }
        : null,
    (() => {
      const format = isDoujinProductFormat(work.productFormatNormalized)
        ? work.productFormatNormalized
        : normalizeDoujinProductFormat({
            productFormat: work.productFormat,
            volume: work.volume,
            genreNames: work.genreNames,
            title: work.title,
          });
      const label = getDoujinProductFormatLabel(format);
      return label && format
        ? { label: "作品形式", value: label, productFormat: format }
        : null;
    })(),
    hasText(work.releaseDate)
      ? { label: "配信日", value: work.releaseDate }
      : null,
    price
      ? {
          label: "価格",
          value: price,
          valueTone: "price",
          trailing: discount != null ? `${discount}% OFF` : undefined,
        }
      : null,
    original
      ? { label: "通常価格", value: original, valueTone: "original" }
      : null,
    discount != null ? { label: "割引率", value: `${discount}% OFF` } : null,
    isPresentNumber(work.rating)
      ? { label: "評価", value: `★${work.rating.toFixed(1)}` }
      : null,
    isPresentNumber(work.reviewCount)
      ? { label: "レビュー件数", value: `${work.reviewCount}件` }
      : null,
    isPresentNumber(work.pageCount)
      ? { label: "ページ数", value: `${work.pageCount}ページ` }
      : null,
    hasText(work.volume) ? { label: "ボリューム", value: work.volume } : null,
    genres.length > 0
      ? { label: "ジャンル", links: genres }
      : (work.genreNames?.length ?? 0) > 0
        ? { label: "ジャンル", value: (work.genreNames ?? []).join("、") }
        : null,
    hasText(work.siteCode) ? { label: "販売サイト", value: work.siteCode } : null,
    formatUpdatedAt(work.updatedAt)
      ? { label: "最終更新日時", value: formatUpdatedAt(work.updatedAt)! }
      : null,
  ];

  return rows.filter((row): row is DoujinInfoRow => {
    if (!row) return false;
    if (row.links && row.links.length > 0) return true;
    return hasText(row.value);
  });
}

function sharesCircle(work: DoujinWork, other: DoujinWork): boolean {
  const a = new Set(
    work.circleIds?.length
      ? work.circleIds
      : work.circleId
        ? [work.circleId]
        : [],
  );
  if (a.size === 0) return false;
  const b = other.circleIds?.length
    ? other.circleIds
    : other.circleId
      ? [other.circleId]
      : [];
  return b.some((id) => a.has(id));
}

function sharesAuthor(work: DoujinWork, other: DoujinWork): boolean {
  const a = new Set(work.authorIds ?? []);
  if (a.size === 0) return false;
  return (other.authorIds ?? []).some((id) => a.has(id));
}

function sharedGenreCount(work: DoujinWork, other: DoujinWork): number {
  const a = new Set(work.genreIds ?? []);
  if (a.size === 0) return 0;
  return (other.genreIds ?? []).filter((id) => a.has(id)).length;
}

function takeUnique(
  buckets: DoujinWork[][],
  limit: number,
): DoujinWork[] {
  const seen = new Set<string>();
  const result: DoujinWork[] = [];
  for (const bucket of buckets) {
    for (const item of bucket) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(toDoujinCardWork(item));
      if (result.length >= limit) return result;
    }
  }
  return result;
}

/**
 * 詳細ページ用の関連セクションを1パスで組み立てる（N+1回避）。
 */
export function getDoujinWorkDetailSections(
  work: DoujinWork,
  limit = DOUJIN_DETAIL_SECTION_LIMIT,
): DoujinWorkDetailSections {
  const all = getDoujinPublicWorks();
  const others = all.filter((row) => row.id !== work.id);

  const sameCircle: DoujinWork[] = [];
  const sameSeries: DoujinWork[] = [];
  const sameGenreScored: Array<{ row: DoujinWork; shared: number }> = [];
  const sameAuthor: DoujinWork[] = [];
  const worksByAuthorId = new Map<string, DoujinWork[]>();

  for (const row of others) {
    if (work.seriesId && row.seriesId === work.seriesId) {
      sameSeries.push(row);
    }
    if (sharesCircle(work, row)) {
      sameCircle.push(row);
    }
    const shared = sharedGenreCount(work, row);
    if (shared > 0) {
      sameGenreScored.push({ row, shared });
    }
    if (sharesAuthor(work, row)) {
      sameAuthor.push(row);
    }
  }

  // 作者サマリー用に全作品を作者へ割当
  for (const row of all) {
    for (const authorId of row.authorIds ?? []) {
      const list = worksByAuthorId.get(authorId);
      if (list) list.push(row);
      else worksByAuthorId.set(authorId, [row]);
    }
  }

  const authorIds = work.authorIds ?? [];
  const authorNames = work.authorNames ?? [];
  const authors: DoujinWorkAuthorSummary[] = authorIds
    .map((id, index) => {
      const name = authorNames[index]?.trim();
      if (!hasText(id) || !hasText(name)) return null;
      const authorWorks = worksByAuthorId.get(id) ?? [];
      return {
        id,
        name,
        workCount: authorWorks.length,
        representativeWork: getRepresentativeWorkForAuthor(authorWorks),
      };
    })
    .filter((row): row is DoujinWorkAuthorSummary => Boolean(row));

  sameGenreScored.sort((a, b) => {
    if (b.shared !== a.shared) return b.shared - a.shared;
    const rankA =
      a.row.currentPopularRank ??
      a.row.initialPopularRank ??
      Number.MAX_SAFE_INTEGER;
    const rankB =
      b.row.currentPopularRank ??
      b.row.initialPopularRank ??
      Number.MAX_SAFE_INTEGER;
    return rankA - rankB;
  });

  const sameGenre = sameGenreScored
    .slice(0, limit)
    .map((item) => toDoujinCardWork(item.row));

  const popularSorted = sortDoujinWorks(others, "popular");
  const newestSorted = sortDoujinWorks(others, "new");

  const related = takeUnique(
    [sameSeries, sameCircle, sameGenreScored.map((item) => item.row), sameAuthor, popularSorted],
    limit,
  );

  return {
    authors,
    sameCircle: sameCircle.slice(0, limit).map(toDoujinCardWork),
    sameSeries: sameSeries.slice(0, limit).map(toDoujinCardWork),
    sameGenre,
    related,
    popular: popularSorted.slice(0, limit).map(toDoujinCardWork),
    newest: newestSorted.slice(0, limit).map(toDoujinCardWork),
  };
}
