import "server-only";

import { cache } from "react";
import { statSync } from "fs";
import { getRepresentativeWorkForAuthor } from "@/lib/doujin/author-representative";
import { extractDoujinAuthorComment } from "@/lib/doujin/author-comment";
import {
  getDoujinPublicCatalogRevalidateSec,
  isDoujinCatalogCacheEnabled,
} from "@/lib/doujin/cost-flags";
import {
  loadDoujinAuthors,
  loadDoujinCircles,
  loadDoujinGenres,
  loadDoujinSeries,
  loadDoujinWorks,
} from "@/lib/doujin/storage";
import { DOUJIN_WORKS_FILE } from "@/lib/doujin/storage-paths";
import { sanitizeDoujinSampleImageUrls } from "@/lib/doujin/sample-images";
import { normalizeDoujinProductFormat } from "@/lib/doujin/product-format";
import type {
  DoujinGenre,
  DoujinStoredAuthor,
  DoujinStoredCircle,
  DoujinStoredGenre,
  DoujinStoredSeries,
  DoujinStoredWork,
  DoujinWork,
} from "@/lib/doujin/types";
import {
  getDoujinPublicCatalogMemoryHolder,
  invalidateDoujinPublicCatalogMemory,
} from "@/lib/doujin/public-catalog-cache";
import { getDoujinCatalogStats } from "@/lib/doujin/upsert";
import type { DoujinWorkSortKey } from "@/lib/doujin/catalog-types";
import { incrPerfCounter } from "@/lib/perf/measure";

export { invalidateDoujinPublicCatalogMemory };

export type { DoujinWorkSortKey } from "@/lib/doujin/catalog-types";

function toPublicWork(
  work: DoujinStoredWork,
  circles: Map<string, DoujinStoredCircle>,
  authors: Map<string, DoujinStoredAuthor>,
  seriesMap: Map<string, DoujinStoredSeries>,
  genres: Map<string, DoujinStoredGenre>,
): DoujinWork {
  const circleEntities = work.circleIds
    .map((id) => circles.get(id))
    .filter((row): row is DoujinStoredCircle => Boolean(row));
  const circle = circleEntities[0];
  const authorEntities = work.authorIds
    .map((id) => authors.get(id))
    .filter((row): row is DoujinStoredAuthor => Boolean(row));
  const series = work.seriesId ? seriesMap.get(work.seriesId) : undefined;
  const genreEntities = work.genreIds
    .map((id) => genres.get(id))
    .filter((row): row is DoujinStoredGenre => Boolean(row));
  const genreNames = genreEntities.map((row) => row.name);
  const productFormatNormalized =
    work.productFormatNormalized &&
    ["comic", "cg", "video", "audio", "game", "voice_comic", "novel", "other"].includes(
      work.productFormatNormalized,
    )
      ? work.productFormatNormalized
      : normalizeDoujinProductFormat({
          productFormat: work.productFormat,
          volume: work.volume,
          genreNames,
          title: work.title,
          rawApiResponse: work.rawApiResponse,
        }) ?? undefined;

  return {
    id: work.id,
    contentId: work.contentId,
    title: work.title,
    description: work.description,
    imageListUrl: work.imageListUrl,
    imageLargeUrl: work.imageLargeUrl,
    sampleImageUrls: sanitizeDoujinSampleImageUrls(work.sampleImageUrls, [
      work.imageLargeUrl,
      work.imageListUrl,
      work.imageSmallUrl,
    ]),
    // 表示用の代表URL。list(pt)は90×90切り抜きのため large(pl) を優先
    imageUrl:
      work.imageLargeUrl ||
      work.imageListUrl ||
      work.sampleImageUrls?.[0] ||
      work.imageSmallUrl ||
      undefined,
    affiliateUrl: work.affiliateUrl,
    circleId: circle?.id,
    circleName: circle?.name,
    circleIds: circleEntities.map((row) => row.id),
    circleNames: circleEntities.map((row) => row.name),
    authorIds: authorEntities.map((row) => row.id),
    authorNames: authorEntities.map((row) => row.name),
    seriesId: series?.id,
    seriesName: series?.name,
    genreIds: genreEntities.map((row) => row.id),
    genreNames,
    price: work.price ?? undefined,
    originalPrice: work.originalPrice ?? undefined,
    isSale: work.isSale,
    saleEndAt: work.saleEndAt ?? undefined,
    releaseDate: work.releaseDate,
    rating: work.rating ?? undefined,
    reviewCount: work.reviewCount ?? undefined,
    productFormat: work.productFormat,
    productFormatNormalized,
    discountRate: work.discountRate ?? undefined,
    pageCount: work.pageCount ?? undefined,
    volume: work.volume,
    siteCode: work.siteCode,
    updatedAt: work.updatedAt,
    initialPopularRank: work.initialPopularRank ?? work.popularImportRank,
    currentPopularRank: work.currentPopularRank,
    newImportRank: work.newImportRank,
  };
}

type CatalogContext = {
  works: DoujinStoredWork[];
  circles: Map<string, DoujinStoredCircle>;
  authors: Map<string, DoujinStoredAuthor>;
  seriesMap: Map<string, DoujinStoredSeries>;
  genres: Map<string, DoujinStoredGenre>;
};

type MemoryCatalogCache = {
  loadedAt: number;
  mtimeMs: number;
  size: number;
  ctx: CatalogContext;
};

function getMemoryCatalogCache(): MemoryCatalogCache | null {
  return getDoujinPublicCatalogMemoryHolder().cache as MemoryCatalogCache | null;
}

function setMemoryCatalogCache(value: MemoryCatalogCache | null): void {
  getDoujinPublicCatalogMemoryHolder().cache = value;
}

function loadCatalogContextUncached(): CatalogContext {
  incrPerfCounter("doujin.public.catalog.load");
  const works = loadDoujinWorks().filter((work) => work.isPublished !== false);
  const circles = new Map(loadDoujinCircles().map((row) => [row.id, row]));
  const authors = new Map(loadDoujinAuthors().map((row) => [row.id, row]));
  const seriesMap = new Map(loadDoujinSeries().map((row) => [row.id, row]));
  const genres = new Map(loadDoujinGenres().map((row) => [row.id, row]));
  return { works, circles, authors, seriesMap, genres };
}

function getWorksFileMeta(): { mtimeMs: number; size: number } {
  try {
    const st = statSync(DOUJIN_WORKS_FILE);
    return { mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return { mtimeMs: 0, size: 0 };
  }
}

const getCatalogContext = cache((): CatalogContext => {
  if (!isDoujinCatalogCacheEnabled()) {
    return loadCatalogContextUncached();
  }

  const ttlMs = getDoujinPublicCatalogRevalidateSec() * 1000;
  const meta = getWorksFileMeta();
  const now = Date.now();
  const memoryCatalogCache = getMemoryCatalogCache();
  if (
    memoryCatalogCache &&
    memoryCatalogCache.mtimeMs === meta.mtimeMs &&
    memoryCatalogCache.size === meta.size &&
    now - memoryCatalogCache.loadedAt < ttlMs
  ) {
    incrPerfCounter("doujin.public.catalog.hit");
    return memoryCatalogCache.ctx;
  }

  const ctx = loadCatalogContextUncached();
  setMemoryCatalogCache({
    loadedAt: now,
    mtimeMs: meta.mtimeMs,
    size: meta.size,
    ctx,
  });
  incrPerfCounter("doujin.public.catalog.miss");
  return ctx;
});

export function getDoujinPublicWorks(): DoujinWork[] {
  const ctx = getCatalogContext();
  return ctx.works.map((work) =>
    toPublicWork(work, ctx.circles, ctx.authors, ctx.seriesMap, ctx.genres),
  );
}

export function getDoujinWorkById(id: string): DoujinWork | null {
  const ctx = getCatalogContext();
  const work = ctx.works.find((row) => row.id === id);
  if (!work) return null;
  return toPublicWork(
    work,
    ctx.circles,
    ctx.authors,
    ctx.seriesMap,
    ctx.genres,
  );
}

/** 詳細ページ用：raw を含まない作者コメント文字列のみ返す */
export function getDoujinAuthorCommentById(id: string): string | undefined {
  const ctx = getCatalogContext();
  const work = ctx.works.find((row) => row.id === id);
  if (!work) return undefined;
  return extractDoujinAuthorComment(work);
}

/** 同一シリーズ→サークル→ジャンル→作者→人気の優先で関連作品を取得（自身を除く） */
export function getDoujinRelatedWorks(
  work: DoujinWork,
  limit = 8,
): DoujinWork[] {
  const all = getDoujinPublicWorks().filter((row) => row.id !== work.id);
  const circleIds = new Set(
    work.circleIds?.length
      ? work.circleIds
      : work.circleId
        ? [work.circleId]
        : [],
  );
  const authorIds = new Set(work.authorIds ?? []);
  const genreIds = new Set(work.genreIds ?? []);

  const sameSeries: DoujinWork[] = [];
  const sameCircle: DoujinWork[] = [];
  const sameGenre: DoujinWork[] = [];
  const sameAuthor: DoujinWork[] = [];

  for (const row of all) {
    if (work.seriesId && row.seriesId === work.seriesId) sameSeries.push(row);

    const rowCircles = row.circleIds?.length
      ? row.circleIds
      : row.circleId
        ? [row.circleId]
        : [];
    if (rowCircles.some((id) => circleIds.has(id))) sameCircle.push(row);

    if ((row.genreIds ?? []).some((id) => genreIds.has(id))) sameGenre.push(row);

    if ((row.authorIds ?? []).some((id) => authorIds.has(id))) sameAuthor.push(row);
  }

  const popular = sortDoujinWorks(all, "popular");
  const seen = new Set<string>();
  const result: DoujinWork[] = [];
  for (const bucket of [sameSeries, sameCircle, sameGenre, sameAuthor, popular]) {
    for (const item of bucket) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
      if (result.length >= limit) return result;
    }
  }
  return result;
}

export function hasDoujinCatalogData(): boolean {
  return loadDoujinWorks().length > 0;
}

export function sortDoujinWorks(
  works: DoujinWork[],
  sort: DoujinWorkSortKey,
): DoujinWork[] {
  const list = [...works];
  switch (sort) {
    case "popular":
      return list.sort((a, b) => {
        const rankA =
          a.currentPopularRank ?? a.initialPopularRank ?? Number.MAX_SAFE_INTEGER;
        const rankB =
          b.currentPopularRank ?? b.initialPopularRank ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        const reviewDiff = (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
        if (reviewDiff !== 0) return reviewDiff;
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
    case "price-asc":
      return list.sort((a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER));
    case "price-desc":
      return list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    case "rating":
      return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "discount":
      return list.sort(
        (a, b) => (b.discountRate ?? 0) - (a.discountRate ?? 0),
      );
    case "new":
    default:
      return list.sort((a, b) =>
        String(b.releaseDate ?? "").localeCompare(String(a.releaseDate ?? "")),
      );
  }
}

export function getDoujinSaleWorks(limit?: number): DoujinWork[] {
  const works = getDoujinPublicWorks().filter((work) => work.isSale);
  return typeof limit === "number" ? works.slice(0, limit) : works;
}

export function getDoujinPopularWorks(limit = 8): DoujinWork[] {
  return sortDoujinWorks(getDoujinPublicWorks(), "popular").slice(0, limit);
}

export function getDoujinRandomComparePair(): [DoujinWork, DoujinWork] | null {
  const works = getDoujinPublicWorks();
  if (works.length < 2) return null;
  const shuffled = [...works].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

export function searchDoujinCatalog(query: string): DoujinWork[] {
  const q = query.trim().toLowerCase();
  const works = getDoujinPublicWorks();
  if (!q) return works;
  return works.filter((work) => {
    const haystack = [
      work.title,
      work.circleName,
      ...(work.authorNames ?? []),
      ...(work.genreNames ?? []),
      work.seriesName,
      work.contentId,
      work.id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function getDoujinGenreList(): DoujinGenre[] {
  const ctx = getCatalogContext();
  return [...ctx.genres.values()]
    .map((genre) => ({
      id: genre.id,
      name: genre.name,
      workCount: ctx.works.filter((work) => work.genreIds.includes(genre.id))
        .length,
    }))
    .filter((genre) => genre.workCount > 0)
    .sort((a, b) => b.workCount - a.workCount);
}

export function getDoujinCircleList() {
  const ctx = getCatalogContext();
  return [...ctx.circles.values()]
    .map((circle) => {
      const works = ctx.works.filter((work) =>
        work.circleIds.includes(circle.id),
      );
      return {
        id: circle.id,
        name: circle.name,
        workCount: works.length,
        representativeWork: works[0]
          ? toPublicWork(
              works[0],
              ctx.circles,
              ctx.authors,
              ctx.seriesMap,
              ctx.genres,
            )
          : null,
      };
    })
    .filter((row) => row.workCount > 0)
    .sort((a, b) => b.workCount - a.workCount);
}

export function getDoujinAuthorList(): Array<{
  id: string;
  name: string;
  workCount: number;
  works: DoujinWork[];
}> {
  const ctx = getCatalogContext();
  // 作品→作者を一度だけ走査して作者ごとの作品配列を構築（N+1回避）
  const worksByAuthorId = new Map<string, DoujinStoredWork[]>();
  for (const work of ctx.works) {
    for (const authorId of work.authorIds) {
      const list = worksByAuthorId.get(authorId);
      if (list) list.push(work);
      else worksByAuthorId.set(authorId, [work]);
    }
  }

  return [...ctx.authors.values()]
    .map((author) => {
      const storedWorks = worksByAuthorId.get(author.id) ?? [];
      const works = storedWorks.map((work) =>
        toPublicWork(
          work,
          ctx.circles,
          ctx.authors,
          ctx.seriesMap,
          ctx.genres,
        ),
      );
      return {
        id: author.id,
        name: author.name,
        workCount: works.length,
        works,
      };
    })
    .filter((row) => row.workCount > 0)
    .sort((a, b) => b.workCount - a.workCount);
}

/** 作者名検索用の候補（作品検索結果とは別） */
export function searchDoujinAuthors(query: string): Array<{
  id: string;
  name: string;
  workCount: number;
  representativeWork: ReturnType<typeof getRepresentativeWorkForAuthor>;
}> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getDoujinAuthorList()
    .filter((author) => author.name.toLowerCase().includes(q))
    .slice(0, 8)
    .map((author) => ({
      id: author.id,
      name: author.name,
      workCount: author.workCount,
      representativeWork: getRepresentativeWorkForAuthor(author.works),
    }));
}

export function getDoujinSeriesList() {
  const ctx = getCatalogContext();
  return [...ctx.seriesMap.values()]
    .map((series) => {
      const works = ctx.works.filter((work) => work.seriesId === series.id);
      return {
        id: series.id,
        name: series.name,
        workCount: works.length,
      };
    })
    .filter((row) => row.workCount > 0)
    .sort((a, b) => b.workCount - a.workCount);
}

export function getDoujinWorksByCircleId(circleId: string): DoujinWork[] {
  const ctx = getCatalogContext();
  return ctx.works
    .filter((work) => work.circleIds.includes(circleId))
    .map((work) =>
      toPublicWork(work, ctx.circles, ctx.authors, ctx.seriesMap, ctx.genres),
    );
}

export function getDoujinWorksByAuthorId(authorId: string): DoujinWork[] {
  const ctx = getCatalogContext();
  return ctx.works
    .filter((work) => work.authorIds.includes(authorId))
    .map((work) =>
      toPublicWork(work, ctx.circles, ctx.authors, ctx.seriesMap, ctx.genres),
    );
}

export function getDoujinWorksBySeriesId(seriesId: string): DoujinWork[] {
  const ctx = getCatalogContext();
  return ctx.works
    .filter((work) => work.seriesId === seriesId)
    .map((work) =>
      toPublicWork(work, ctx.circles, ctx.authors, ctx.seriesMap, ctx.genres),
    );
}

export function getDoujinWorksByGenreId(genreId: string): DoujinWork[] {
  const ctx = getCatalogContext();
  return ctx.works
    .filter((work) => work.genreIds.includes(genreId))
    .map((work) =>
      toPublicWork(work, ctx.circles, ctx.authors, ctx.seriesMap, ctx.genres),
    );
}

export function getDoujinCircleById(id: string) {
  return loadDoujinCircles().find((row) => row.id === id) ?? null;
}

export function getDoujinAuthorById(id: string) {
  return loadDoujinAuthors().find((row) => row.id === id) ?? null;
}

export function getDoujinSeriesById(id: string) {
  return loadDoujinSeries().find((row) => row.id === id) ?? null;
}

export function getDoujinGenreById(id: string) {
  return loadDoujinGenres().find((row) => row.id === id) ?? null;
}

export { getDoujinCatalogStats };
