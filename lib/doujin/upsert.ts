import "server-only";

import { createHash } from "node:crypto";
import { revalidateTag } from "next/cache";
import { isDoujinBatchedImportEnabled } from "@/lib/doujin/cost-flags";
import { normalizeDoujinTitle } from "@/lib/doujin/normalize";
import { normalizeDoujinProductFormat } from "@/lib/doujin/product-format";
import { sanitizeDoujinSampleImageUrls } from "@/lib/doujin/sample-images";
import {
  appendDoujinFetchLog,
  loadDoujinAuthors,
  loadDoujinCircles,
  loadDoujinFetchLogs,
  loadDoujinGenres,
  loadDoujinSeries,
  loadDoujinWorkAuthors,
  loadDoujinWorkCircles,
  loadDoujinWorkGenres,
  loadDoujinWorks,
  saveDoujinAuthors,
  saveDoujinCircles,
  saveDoujinGenres,
  saveDoujinRawEntries,
  saveDoujinSeries,
  saveDoujinWorkAuthors,
  saveDoujinWorkCircles,
  saveDoujinWorkGenres,
  saveDoujinWorks,
  type DoujinRawEntry,
  type DoujinWorkAuthor,
  type DoujinWorkCircle,
  type DoujinWorkGenre,
} from "@/lib/doujin/storage";
import { invalidateDoujinPublicCatalogMemory } from "@/lib/doujin/public-catalog-cache";
import type {
  DoujinEntityRef,
  DoujinStoredAuthor,
  DoujinStoredCircle,
  DoujinStoredGenre,
  DoujinStoredSeries,
  DoujinStoredWork,
  NormalizedDoujinApiItem,
} from "@/lib/doujin/types";
import {
  changedLightFields,
  hasFullDisplayDiff,
  hasLightFieldDiff,
  hasRawDiff,
  lightFieldsFromNormalized,
} from "@/lib/doujin/sync-diff";
import {
  DOUJIN_SYNC_MODE_FULL,
  DOUJIN_SYNC_MODE_LIGHT,
  type DoujinSyncMode,
} from "@/lib/doujin/sync-mode";
import { doujinRawShardKey } from "@/lib/doujin/storage-paths";
import { incrPerfCounter } from "@/lib/perf/measure";

const DOUJIN_PUBLIC_CATALOG_TAG = "doujin-public-catalog";

function resolveProductFormatNormalized(input: {
  productFormat?: string;
  volume?: string;
  title: string;
  genreNames: string[];
  rawApiResponse?: Record<string, unknown>;
}): string | undefined {
  return (
    normalizeDoujinProductFormat({
      productFormat: input.productFormat,
      volume: input.volume,
      title: input.title,
      genreNames: input.genreNames,
      rawApiResponse: input.rawApiResponse,
    }) ?? undefined
  );
}

function hashId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 16)}`;
}

function upsertEntity<
  T extends {
    id: string;
    externalId?: string;
    name: string;
    ruby?: string;
    createdAt: string;
    updatedAt: string;
  },
>(
  list: T[],
  entity: DoujinEntityRef,
  prefix: string,
  now: string,
): { list: T[]; id: string; created: boolean; changed: boolean } {
  if (entity.externalId) {
    const existing = list.find((row) => row.externalId === entity.externalId);
    if (existing) {
      let changed = false;
      if (existing.name !== entity.name) {
        existing.name = entity.name;
        changed = true;
      }
      if ((entity.ruby ?? existing.ruby) !== existing.ruby) {
        existing.ruby = entity.ruby ?? existing.ruby;
        changed = true;
      }
      if (changed) existing.updatedAt = now;
      return { list, id: existing.id, created: false, changed };
    }
  }

  const nameKey = normalizeDoujinTitle(entity.name);
  const byName = list.find((row) => {
    const rowKey =
      "normalizedName" in row && typeof row.normalizedName === "string"
        ? row.normalizedName
        : normalizeDoujinTitle(row.name);
    return !row.externalId && rowKey === nameKey;
  });
  if (byName && !entity.externalId) {
    let changed = false;
    if (byName.name !== entity.name) {
      byName.name = entity.name;
      changed = true;
    }
    if ((entity.ruby ?? byName.ruby) !== byName.ruby) {
      byName.ruby = entity.ruby ?? byName.ruby;
      changed = true;
    }
    if ("normalizedName" in byName) {
      (byName as { normalizedName?: string }).normalizedName = nameKey;
    }
    if (changed) byName.updatedAt = now;
    return { list, id: byName.id, created: false, changed };
  }

  const id = entity.externalId
    ? hashId(prefix, `ext:${entity.externalId}`)
    : hashId(prefix, `name:${nameKey}`);

  const created = {
    id,
    externalId: entity.externalId,
    name: entity.name,
    ruby: entity.ruby,
    normalizedName: nameKey,
    createdAt: now,
    updatedAt: now,
  } as unknown as T;

  return { list: [...list, created], id, created: true, changed: true };
}

function findExistingWork(
  works: DoujinStoredWork[],
  item: NormalizedDoujinApiItem,
  index?: {
    byExternal: Map<string, DoujinStoredWork>;
    byContentFloor: Map<string, DoujinStoredWork>;
  },
): DoujinStoredWork | undefined {
  if (index) {
    return (
      index.byExternal.get(item.externalProductId) ??
      index.byContentFloor.get(`${item.contentId}::${item.floorCode}`)
    );
  }

  const byExternal = works.find(
    (work) => work.externalProductId === item.externalProductId,
  );
  if (byExternal) return byExternal;

  return works.find(
    (work) =>
      work.contentId === item.contentId && work.floorCode === item.floorCode,
  );
}

function buildWorkIndex(works: DoujinStoredWork[]) {
  const byExternal = new Map<string, DoujinStoredWork>();
  const byContentFloor = new Map<string, DoujinStoredWork>();
  for (const work of works) {
    byExternal.set(work.externalProductId, work);
    byContentFloor.set(`${work.contentId}::${work.floorCode}`, work);
  }
  return { byExternal, byContentFloor };
}

export function findDoujinStoredWork(
  item: NormalizedDoujinApiItem,
): DoujinStoredWork | undefined {
  return findExistingWork(loadDoujinWorks(), item);
}

export type DoujinCatalogMutableState = {
  works: DoujinStoredWork[];
  circles: DoujinStoredCircle[];
  authors: DoujinStoredAuthor[];
  seriesList: DoujinStoredSeries[];
  genres: DoujinStoredGenre[];
  workCircles: DoujinWorkCircle[];
  workAuthors: DoujinWorkAuthor[];
  workGenres: DoujinWorkGenre[];
  rawByWorkId: Record<string, DoujinRawEntry>;
  dirty: boolean;
};

export function loadDoujinCatalogMutableState(): DoujinCatalogMutableState {
  incrPerfCounter("doujin.catalog.loadState");
  return {
    works: loadDoujinWorks(),
    circles: loadDoujinCircles(),
    authors: loadDoujinAuthors(),
    seriesList: loadDoujinSeries(),
    genres: loadDoujinGenres(),
    workCircles: loadDoujinWorkCircles(),
    workAuthors: loadDoujinWorkAuthors(),
    workGenres: loadDoujinWorkGenres(),
    rawByWorkId: {},
    dirty: false,
  };
}

export type PersistDoujinCatalogResult = {
  wroteWorks: boolean;
  wroteRaw: boolean;
  wroteAny: boolean;
  revalidated: boolean;
};

export function persistDoujinCatalogMutableState(
  state: DoujinCatalogMutableState,
  options?: {
    dryRun?: boolean;
    revalidatePublicCatalog?: boolean;
    /** light sync は表示用 works のみ。entity / raw は触らない */
    scope?: "all" | "works";
  },
): PersistDoujinCatalogResult {
  if (options?.dryRun || !state.dirty) {
    return {
      wroteWorks: false,
      wroteRaw: false,
      wroteAny: false,
      revalidated: false,
    };
  }

  incrPerfCounter("doujin.catalog.persist");
  const scope = options?.scope ?? "all";
  const worksResult = saveDoujinWorks(state.works);

  let wroteRaw = false;
  if (scope === "all") {
    saveDoujinCircles(state.circles);
    saveDoujinAuthors(state.authors);
    saveDoujinSeries(state.seriesList);
    saveDoujinGenres(state.genres);
    saveDoujinWorkCircles(state.workCircles);
    saveDoujinWorkAuthors(state.workAuthors);
    saveDoujinWorkGenres(state.workGenres);
    const rawResult = saveDoujinRawEntries(state.rawByWorkId);
    wroteRaw = rawResult.wrote;
  }

  let revalidated = false;
  if (
    options?.revalidatePublicCatalog !== false &&
    (worksResult.wrote || wroteRaw)
  ) {
    invalidateDoujinPublicCatalogMemory();
    try {
      revalidateTag(DOUJIN_PUBLIC_CATALOG_TAG);
      revalidated = true;
    } catch {
      // build/scripts など cache 外でも落とさない
    }
  }

  state.dirty = false;
  return {
    wroteWorks: worksResult.wrote,
    wroteRaw,
    wroteAny: worksResult.wrote || wroteRaw,
    revalidated,
  };
}

export type UpsertDoujinResult = {
  created: number;
  updated: number;
  duplicate: number;
  unchanged: number;
  skipped: number;
  errors: number;
  workIds: string[];
  changed: boolean;
  changedFields: string[];
  rawShardsTouched: string[];
  results: Array<{
    workId: string;
    contentId: string;
    created: boolean;
    updated: boolean;
    unchanged: boolean;
    wasPopularImport: boolean;
    changedFields: string[];
  }>;
};


/**
 * 読み込み済み state へ正規化アイテムを適用する（ファイル I/O なし）。
 * raw は state.rawByWorkId に分離して保持する。
 * syncMode=light の既存作品は価格・評価・順位のみ更新する。
 */
export function applyNormalizedDoujinItems(
  state: DoujinCatalogMutableState,
  items: NormalizedDoujinApiItem[],
  options?: {
    jobId?: string;
    popularityBaseOffset?: number;
    dryRun?: boolean;
    importMetaBaseOffset?: number;
    importPhase?: "POPULAR" | "NEW";
    /** 未指定時は full（従来の import/fetch 互換） */
    syncMode?: DoujinSyncMode;
  },
): UpsertDoujinResult {
  const syncMode = options?.syncMode ?? DOUJIN_SYNC_MODE_FULL;
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let duplicate = 0;
  let unchanged = 0;
  const skipped = 0;
  let errors = 0;
  const workIds: string[] = [];
  const results: UpsertDoujinResult["results"] = [];
  const changedFieldSet = new Set<string>();
  const rawShardsTouched = new Set<string>();
  let changed = false;
  const index = buildWorkIndex(state.works);

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    try {
      const existing = findExistingWork(state.works, item, index);
      const wasPopularImport = Boolean(
        existing &&
          (existing.importSource === "POPULAR" ||
            existing.importSource === "POPULAR_AND_NEW" ||
            existing.popularImportRank != null ||
            existing.initialPopularRank != null),
      );

      const popularityRank =
        options?.popularityBaseOffset != null
          ? options.popularityBaseOffset + itemIndex
          : undefined;

      if (existing && syncMode === DOUJIN_SYNC_MODE_LIGHT) {
        const light = lightFieldsFromNormalized(item, popularityRank);
        const fields = changedLightFields(existing, light);
        if (!hasLightFieldDiff(existing, light)) {
          unchanged += 1;
          duplicate += 1;
          workIds.push(existing.id);
          results.push({
            workId: existing.id,
            contentId: item.contentId,
            created: false,
            updated: false,
            unchanged: true,
            wasPopularImport,
            changedFields: [],
          });
          continue;
        }

        const next: DoujinStoredWork = {
          ...existing,
          ...light,
          lastFetchedAt: now,
          updatedAt: now,
          rankUpdatedAt:
            light.currentPopularRank !== existing.currentPopularRank
              ? now
              : existing.rankUpdatedAt,
        };
        state.works = state.works.map((work) =>
          work.id === existing.id ? next : work,
        );
        index.byExternal.set(next.externalProductId, next);
        index.byContentFloor.set(`${next.contentId}::${next.floorCode}`, next);
        for (const field of fields) changedFieldSet.add(field);
        changedFieldSet.add("lastFetchedAt");
        changed = true;
        updated += 1;
        duplicate += 1;
        workIds.push(existing.id);
        results.push({
          workId: existing.id,
          contentId: item.contentId,
          created: false,
          updated: true,
          unchanged: false,
          wasPopularImport,
          changedFields: fields,
        });
        continue;
      }

      const circleIds: string[] = [];
      for (const circle of item.circles) {
        const result = upsertEntity(state.circles, circle, "circle", now);
        state.circles = result.list;
        circleIds.push(result.id);
        if (result.changed) changed = true;
      }

      const authorIds: string[] = [];
      for (const author of item.authors) {
        const result = upsertEntity(state.authors, author, "author", now);
        state.authors = result.list;
        authorIds.push(result.id);
        if (result.changed) changed = true;
      }

      let seriesId: string | undefined;
      if (item.series[0]) {
        const result = upsertEntity(
          state.seriesList,
          item.series[0],
          "series",
          now,
        );
        state.seriesList = result.list;
        seriesId = result.id;
        if (result.changed) changed = true;
      }

      const genreIds: string[] = [];
      for (const genre of item.genres) {
        const result = upsertEntity(state.genres, genre, "genre", now);
        state.genres = result.list;
        genreIds.push(result.id);
        if (result.changed) changed = true;
      }

      const importRank =
        options?.importMetaBaseOffset != null
          ? options.importMetaBaseOffset + itemIndex
          : undefined;

      const sampleImageUrls = sanitizeDoujinSampleImageUrls(item.sampleImages, [
        item.images.large,
        item.images.list,
        item.images.small,
      ]);

      const productFormatNormalized = resolveProductFormatNormalized({
        productFormat: item.productFormat,
        volume: item.volume,
        title: item.title,
        genreNames: item.genres.map((genre) => genre.name),
        rawApiResponse: item.rawApiResponse,
      });

      const applyImportFields = (
        base: DoujinStoredWork,
      ): Pick<
        DoujinStoredWork,
        | "importSource"
        | "popularImportRank"
        | "popularImportedAt"
        | "initialPopularRank"
        | "currentPopularRank"
        | "rankUpdatedAt"
        | "newImportRank"
        | "newImportedAt"
        | "sourcePopularityRank"
      > => {
        if (options?.importPhase === "POPULAR" && importRank != null) {
          const prev = base.importSource;
          const importSource =
            prev === "NEW" || prev === "POPULAR_AND_NEW"
              ? "POPULAR_AND_NEW"
              : "POPULAR";
          return {
            importSource,
            popularImportRank: importRank,
            popularImportedAt: now,
            initialPopularRank: base.initialPopularRank ?? importRank,
            currentPopularRank: importRank,
            rankUpdatedAt: now,
            sourcePopularityRank: importRank,
            newImportRank: base.newImportRank,
            newImportedAt: base.newImportedAt,
          };
        }
        if (options?.importPhase === "NEW" && importRank != null) {
          const prev = base.importSource;
          const importSource =
            prev === "POPULAR" || prev === "POPULAR_AND_NEW"
              ? "POPULAR_AND_NEW"
              : "NEW";
          return {
            importSource,
            newImportRank: importRank,
            newImportedAt: now,
            popularImportRank: base.popularImportRank,
            popularImportedAt: base.popularImportedAt,
            initialPopularRank: base.initialPopularRank,
            currentPopularRank: base.currentPopularRank,
            rankUpdatedAt: base.rankUpdatedAt,
            sourcePopularityRank: popularityRank ?? base.sourcePopularityRank,
          };
        }
        return {
          importSource: base.importSource,
          popularImportRank: base.popularImportRank,
          popularImportedAt: base.popularImportedAt,
          initialPopularRank: base.initialPopularRank,
          currentPopularRank: popularityRank ?? base.currentPopularRank,
          rankUpdatedAt:
            popularityRank != null && popularityRank !== base.currentPopularRank
              ? now
              : base.rankUpdatedAt,
          newImportRank: base.newImportRank,
          newImportedAt: base.newImportedAt,
          sourcePopularityRank: popularityRank ?? base.sourcePopularityRank,
        };
      };

      if (existing) {
        const nextBase: DoujinStoredWork = {
          ...existing,
          externalProductId: item.externalProductId,
          contentId: item.contentId,
          title: item.title,
          titleNormalized: item.titleNormalized,
          description: item.description ?? existing.description,
          affiliateUrl: item.affiliateUrl ?? existing.affiliateUrl,
          productUrl: item.productUrl ?? existing.productUrl,
          imageSmallUrl: item.images.small ?? existing.imageSmallUrl,
          imageListUrl: item.images.list ?? existing.imageListUrl,
          imageLargeUrl: item.images.large ?? existing.imageLargeUrl,
          sampleImageUrls:
            sampleImageUrls.length > 0
              ? sampleImageUrls
              : (existing.sampleImageUrls ?? []),
          price: item.price,
          originalPrice: item.originalPrice,
          discountRate: item.discountRate,
          isSale: item.isSale,
          saleEndAt: item.saleEndAt,
          releaseDate: item.releaseDate ?? existing.releaseDate,
          rating: item.rating,
          reviewCount: item.reviewCount,
          productFormat: item.productFormat ?? existing.productFormat,
          productFormatNormalized,
          volume: item.volume ?? existing.volume,
          pageCount: item.pageCount ?? existing.pageCount,
          siteCode: item.siteCode,
          serviceCode: item.serviceCode,
          floorCode: item.floorCode,
          circleIds,
          authorIds,
          seriesId,
          genreIds,
          ...applyImportFields(existing),
          lastFetchedAt: now,
        };

        const dataChanged = hasFullDisplayDiff(existing, nextBase);
        const rawChanged =
          syncMode === DOUJIN_SYNC_MODE_FULL &&
          hasRawDiff(
            state.rawByWorkId[existing.id]?.rawApiResponse,
            item.rawApiResponse,
          );

        const next: DoujinStoredWork =
          dataChanged || rawChanged
            ? { ...nextBase, updatedAt: now }
            : { ...existing, lastFetchedAt: now };

        if (dataChanged || rawChanged) {
          state.works = state.works.map((work) =>
            work.id === existing.id ? next : work,
          );
          index.byExternal.set(next.externalProductId, next);
          index.byContentFloor.set(`${next.contentId}::${next.floorCode}`, next);
          updated += 1;
          changed = true;
          if (dataChanged) {
            changedFieldSet.add("full-display");
            state.workCircles = replaceWorkLinks(
              state.workCircles,
              existing.id,
              circleIds,
              "circleId",
            );
            state.workAuthors = replaceWorkLinks(
              state.workAuthors,
              existing.id,
              authorIds,
              "authorId",
            );
            state.workGenres = replaceWorkLinks(
              state.workGenres,
              existing.id,
              genreIds,
              "genreId",
            );
          }
        } else {
          // lastFetchedAt のみの更新は表示差分ではないため works 配列は触らない
          unchanged += 1;
        }

        if (rawChanged) {
          state.rawByWorkId[existing.id] = {
            rawApiResponse: item.rawApiResponse,
            updatedAt: now,
          };
          rawShardsTouched.add(doujinRawShardKey(existing.id));
          changed = true;
          changedFieldSet.add("rawApiResponse");
        }

        workIds.push(existing.id);
        duplicate += 1;
        results.push({
          workId: existing.id,
          contentId: item.contentId,
          created: false,
          updated: dataChanged || rawChanged,
          unchanged: !dataChanged && !rawChanged,
          wasPopularImport,
          changedFields: [
            ...(dataChanged ? ["full-display"] : []),
            ...(rawChanged ? ["rawApiResponse"] : []),
          ],
        });
      } else {
        const id = hashId(
          "work",
          `${item.floorCode}:${item.contentId}:${item.externalProductId}`,
        );
        const createdBase = {
          id,
          externalProductId: item.externalProductId,
          contentId: item.contentId,
          title: item.title,
          titleNormalized: item.titleNormalized,
          description: item.description,
          affiliateUrl: item.affiliateUrl,
          productUrl: item.productUrl,
          imageSmallUrl: item.images.small,
          imageListUrl: item.images.list,
          imageLargeUrl: item.images.large,
          sampleImageUrls,
          price: item.price,
          originalPrice: item.originalPrice,
          discountRate: item.discountRate,
          isSale: item.isSale,
          saleEndAt: item.saleEndAt,
          releaseDate: item.releaseDate,
          rating: item.rating,
          reviewCount: item.reviewCount,
          productFormat: item.productFormat,
          productFormatNormalized,
          volume: item.volume,
          pageCount: item.pageCount,
          siteCode: item.siteCode,
          serviceCode: item.serviceCode,
          floorCode: item.floorCode,
          circleIds,
          authorIds,
          seriesId,
          genreIds,
          isPublished: true,
          createdAt: now,
          updatedAt: now,
          lastFetchedAt: now,
        } as DoujinStoredWork;
        const createdWork: DoujinStoredWork = {
          ...createdBase,
          ...applyImportFields(createdBase),
        };
        state.works = [createdWork, ...state.works];
        index.byExternal.set(createdWork.externalProductId, createdWork);
        index.byContentFloor.set(
          `${createdWork.contentId}::${createdWork.floorCode}`,
          createdWork,
        );
        if (syncMode === DOUJIN_SYNC_MODE_FULL) {
          state.rawByWorkId[id] = {
            rawApiResponse: item.rawApiResponse,
            updatedAt: now,
          };
          rawShardsTouched.add(doujinRawShardKey(id));
          changedFieldSet.add("rawApiResponse");
        }
        workIds.push(id);
        created += 1;
        changed = true;
        changedFieldSet.add("created");
        results.push({
          workId: id,
          contentId: item.contentId,
          created: true,
          updated: false,
          unchanged: false,
          wasPopularImport: false,
          changedFields: ["created"],
        });

        state.workCircles = [
          ...state.workCircles,
          ...circleIds.map((circleId) => ({ workId: id, circleId })),
        ];
        state.workAuthors = [
          ...state.workAuthors,
          ...authorIds.map((authorId) => ({ workId: id, authorId })),
        ];
        state.workGenres = [
          ...state.workGenres,
          ...genreIds.map((genreId) => ({ workId: id, genreId })),
        ];
      }
    } catch (error) {
      errors += 1;
      appendDoujinFetchLog({
        level: "error",
        message: "upsert failed",
        jobId: options?.jobId,
        contentId: item.contentId,
        detail: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  if (changed && !options?.dryRun) {
    state.dirty = true;
  }

  return {
    created,
    updated,
    duplicate,
    unchanged,
    skipped,
    errors,
    workIds,
    changed,
    changedFields: [...changedFieldSet],
    rawShardsTouched: [...rawShardsTouched],
    results,
  };
}

/**
 * 互換ラッパー: 1回 load → apply → 1回 save。
 * バッチ処理では applyNormalizedDoujinItems + persist を使うこと。
 */
export function upsertNormalizedDoujinItems(
  items: NormalizedDoujinApiItem[],
  options?: {
    jobId?: string;
    popularityBaseOffset?: number;
    dryRun?: boolean;
    importMetaBaseOffset?: number;
    importPhase?: "POPULAR" | "NEW";
    persist?: boolean;
    state?: DoujinCatalogMutableState;
  },
): UpsertDoujinResult {
  const state = options?.state ?? loadDoujinCatalogMutableState();
  const result = applyNormalizedDoujinItems(state, items, options);
  const shouldPersist =
    options?.persist !== false &&
    !options?.state &&
    !options?.dryRun &&
    result.changed;

  if (shouldPersist || (options?.persist && result.changed && !options.dryRun)) {
    persistDoujinCatalogMutableState(state, {
      dryRun: options?.dryRun,
      revalidatePublicCatalog: true,
    });
  }

  return result;
}

function replaceWorkLinks<
  T extends DoujinWorkCircle | DoujinWorkAuthor | DoujinWorkGenre,
>(
  rows: T[],
  workId: string,
  ids: string[],
  key: "circleId" | "authorId" | "genreId",
): T[] {
  const others = rows.filter((row) => row.workId !== workId);
  const next = ids.map((id) => ({ workId, [key]: id })) as T[];
  return [...others, ...next];
}

export function getDoujinCatalogStats() {
  const works = loadDoujinWorks();
  const logs = loadDoujinFetchLogs();
  return {
    workCount: works.length,
    circleCount: loadDoujinCircles().length,
    authorCount: loadDoujinAuthors().length,
    seriesCount: loadDoujinSeries().length,
    genreCount: loadDoujinGenres().length,
    lastFetchedAt:
      works
        .map((work) => work.lastFetchedAt)
        .sort()
        .at(-1) ?? null,
    errorCount: logs.filter((log) => log.level === "error").length,
  };
}

export function isBatchedDoujinImportActive(): boolean {
  return isDoujinBatchedImportEnabled();
}

export { DOUJIN_PUBLIC_CATALOG_TAG };
