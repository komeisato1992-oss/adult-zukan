import "server-only";

import {
  loadDoujinAuthors,
  loadDoujinCircles,
  loadDoujinGenres,
  loadDoujinSeries,
  loadDoujinWorks,
} from "@/lib/doujin/storage";
import type { DoujinStoredWork } from "@/lib/doujin/types";

export type DoujinWorksAdminSort =
  | "new"
  | "popular"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "discount"
  | "updated";

export type DoujinWorksAdminQuery = {
  q?: string;
  page?: number;
  pageSize?: 20 | 50 | 100;
  sort?: DoujinWorksAdminSort;
  published?: "all" | "published" | "unpublished";
  sale?: "all" | "sale" | "not-sale";
  productFormat?: string;
  circleId?: string;
  authorId?: string;
  seriesId?: string;
  genreId?: string;
};

export type DoujinWorkAdminRow = {
  id: string;
  contentId: string;
  title: string;
  imageUrl?: string;
  circleNames: string[];
  authorNames: string[];
  seriesName?: string;
  genreNames: string[];
  productFormat?: string;
  price: number | null;
  originalPrice: number | null;
  discountRate: number | null;
  rating: number | null;
  reviewCount: number | null;
  releaseDate?: string;
  isSale: boolean;
  isPublished: boolean;
  updatedAt: string;
};

function resolveNames(
  ids: string[],
  map: Map<string, string>,
): string[] {
  return ids.map((id) => map.get(id) ?? id).filter(Boolean);
}

function matchesQuery(work: DoujinStoredWork, q: string, maps: {
  circles: Map<string, string>;
  authors: Map<string, string>;
}): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (work.id.toLowerCase().includes(needle)) return true;
  if (work.contentId.toLowerCase().includes(needle)) return true;
  if (work.title.toLowerCase().includes(needle)) return true;
  if (work.externalProductId.toLowerCase().includes(needle)) return true;
  const circles = resolveNames(work.circleIds, maps.circles);
  const authors = resolveNames(work.authorIds, maps.authors);
  if (circles.some((name) => name.toLowerCase().includes(needle))) return true;
  if (authors.some((name) => name.toLowerCase().includes(needle))) return true;
  return false;
}

function sortWorks(
  works: DoujinStoredWork[],
  sort: DoujinWorksAdminSort,
): DoujinStoredWork[] {
  const next = [...works];
  next.sort((a, b) => {
    switch (sort) {
      case "popular":
        return (a.currentPopularRank ?? a.popularImportRank ?? a.initialPopularRank ?? 999999) -
          (b.currentPopularRank ?? b.popularImportRank ?? b.initialPopularRank ?? 999999);
      case "price-asc":
        return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
      case "price-desc":
        return (b.price ?? -1) - (a.price ?? -1);
      case "rating":
        return (b.rating ?? -1) - (a.rating ?? -1);
      case "discount":
        return (b.discountRate ?? -1) - (a.discountRate ?? -1);
      case "updated":
        return b.updatedAt.localeCompare(a.updatedAt);
      case "new":
      default:
        return (b.releaseDate ?? b.createdAt).localeCompare(a.releaseDate ?? a.createdAt);
    }
  });
  return next;
}

export function listDoujinWorksForAdmin(query: DoujinWorksAdminQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = query.pageSize === 50 || query.pageSize === 100 ? query.pageSize : 20;
  const sort = query.sort ?? "new";
  const published = query.published ?? "all";
  const sale = query.sale ?? "all";

  const works = loadDoujinWorks();
  const circles = new Map(loadDoujinCircles().map((row) => [row.id, row.name]));
  const authors = new Map(loadDoujinAuthors().map((row) => [row.id, row.name]));
  const series = new Map(loadDoujinSeries().map((row) => [row.id, row.name]));
  const genres = new Map(loadDoujinGenres().map((row) => [row.id, row.name]));

  let filtered = works.filter((work) => {
    if (published === "published" && work.isPublished === false) return false;
    if (published === "unpublished" && work.isPublished !== false) return false;
    if (sale === "sale" && !work.isSale) return false;
    if (sale === "not-sale" && work.isSale) return false;
    if (query.productFormat && work.productFormatNormalized !== query.productFormat && work.productFormat !== query.productFormat) {
      return false;
    }
    if (query.circleId && !work.circleIds.includes(query.circleId)) return false;
    if (query.authorId && !work.authorIds.includes(query.authorId)) return false;
    if (query.seriesId && work.seriesId !== query.seriesId) return false;
    if (query.genreId && !work.genreIds.includes(query.genreId)) return false;
    if (query.q && !matchesQuery(work, query.q, { circles, authors })) return false;
    return true;
  });

  filtered = sortWorks(filtered, sort);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  const items: DoujinWorkAdminRow[] = slice.map((work) => ({
    id: work.id,
    contentId: work.contentId,
    title: work.title,
    imageUrl: work.imageListUrl || work.imageLargeUrl || work.imageSmallUrl,
    circleNames: resolveNames(work.circleIds, circles),
    authorNames: resolveNames(work.authorIds, authors),
    seriesName: work.seriesId ? series.get(work.seriesId) : undefined,
    genreNames: resolveNames(work.genreIds, genres),
    productFormat: work.productFormatNormalized || work.productFormat,
    price: work.price,
    originalPrice: work.originalPrice,
    discountRate: work.discountRate,
    rating: work.rating,
    reviewCount: work.reviewCount,
    releaseDate: work.releaseDate,
    isSale: work.isSale,
    isPublished: work.isPublished !== false,
    updatedAt: work.updatedAt,
  }));

  return {
    siteType: "doujin" as const,
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
    filters: {
      circles: loadDoujinCircles().map((row) => ({ id: row.id, name: row.name })),
      authors: loadDoujinAuthors().map((row) => ({ id: row.id, name: row.name })),
      series: loadDoujinSeries().map((row) => ({ id: row.id, name: row.name })),
      genres: loadDoujinGenres().map((row) => ({ id: row.id, name: row.name })),
    },
  };
}

export function listDoujinEntitiesForAdmin(
  kind: "circles" | "authors" | "series" | "genres",
  q?: string,
) {
  const works = loadDoujinWorks();
  const needle = q?.trim().toLowerCase() ?? "";

  if (kind === "circles") {
    const rows = loadDoujinCircles();
    return rows
      .filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.id.includes(needle))
      .map((row) => ({
        id: row.id,
        name: row.name,
        workCount: works.filter((work) => work.circleIds.includes(row.id)).length,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => b.workCount - a.workCount);
  }

  if (kind === "authors") {
    const rows = loadDoujinAuthors();
    return rows
      .filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.id.includes(needle))
      .map((row) => ({
        id: row.id,
        name: row.name,
        workCount: works.filter((work) => work.authorIds.includes(row.id)).length,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => b.workCount - a.workCount);
  }

  if (kind === "series") {
    const rows = loadDoujinSeries();
    return rows
      .filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.id.includes(needle))
      .map((row) => ({
        id: row.id,
        name: row.name,
        workCount: works.filter((work) => work.seriesId === row.id).length,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => b.workCount - a.workCount);
  }

  const rows = loadDoujinGenres();
  return rows
    .filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.id.includes(needle))
    .map((row) => ({
      id: row.id,
      name: row.name,
      workCount: works.filter((work) => work.genreIds.includes(row.id)).length,
      updatedAt: row.updatedAt,
    }))
    .sort((a, b) => b.workCount - a.workCount);
}
