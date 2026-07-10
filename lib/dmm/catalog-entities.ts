import "server-only";

import {
  getDmmItemLabelName,
  getDmmItemMakerName,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import type { DmmItem } from "@/lib/dmm/types";
import { encodeActressSlug, decodeActressSlug, matchesActressSlug } from "@/lib/actresses/slug";
import { getActressReading } from "@/lib/actresses/readings";
import { iterateItemActresses } from "@/lib/dmm/actress-names";
import { buildActressRepresentativeImageMap } from "@/lib/dmm/actress-representative-image";
import { encodeEntitySlug } from "@/lib/entities/paths";
import { slugify } from "@/lib/utils";

export type CatalogEntity = {
  name: string;
  slug: string;
  workCount: number;
};

export type CatalogActressEntity = CatalogEntity & {
  imageUrl?: string;
  reading: string;
  imageFromMultiActressWork?: boolean;
};

export type CatalogLabelEntity = CatalogEntity & {
  makerName?: string;
  makerSlug?: string;
};

export type CatalogSeriesEntity = CatalogEntity & {
  makerName?: string;
  makerSlug?: string;
};

export function isValidCatalogItem(item: DmmItem): boolean {
  return isValidDmmListItem(item) && Boolean(getDmmFanzaUrl(item));
}

export function filterValidCatalogItems(items: DmmItem[]): DmmItem[] {
  return items.filter(isValidCatalogItem);
}

export async function getCatalogItems(): Promise<DmmItem[]> {
  const { getCatalogWorks } = await import("@/lib/catalog");
  return getCatalogWorks();
}

function countBySlug(
  items: DmmItem[],
  matches: (item: DmmItem) => string | undefined,
): Map<string, CatalogEntity> {
  const map = new Map<string, CatalogEntity>();

  for (const item of items) {
    const name = matches(item);
    if (!name) continue;

    const slug = slugify(name);
    if (!slug) continue;

    const existing = map.get(slug);
    map.set(slug, {
      name,
      slug,
      workCount: (existing?.workCount ?? 0) + 1,
    });
  }

  return map;
}

export function getCatalogMakers(items: DmmItem[]): CatalogEntity[] {
  const valid = filterValidCatalogItems(items);
  return [...countBySlug(valid, getDmmItemMakerName).values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ja"),
  );
}

export function getCatalogLabels(items: DmmItem[]): CatalogLabelEntity[] {
  const valid = filterValidCatalogItems(items);
  const map = new Map<string, CatalogLabelEntity>();

  for (const item of valid) {
    const name = getDmmItemLabelName(item);
    if (!name) continue;

    const slug = slugify(name);
    if (!slug) continue;

    const makerName = getDmmItemMakerName(item);
    const existing = map.get(slug);

    map.set(slug, {
      name,
      slug,
      workCount: (existing?.workCount ?? 0) + 1,
      makerName: existing?.makerName ?? makerName,
      makerSlug:
        existing?.makerSlug ??
        (makerName ? slugify(makerName) : undefined),
    });
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export function getCatalogSeries(items: DmmItem[]): CatalogSeriesEntity[] {
  const valid = filterValidCatalogItems(items);
  const map = new Map<string, CatalogSeriesEntity>();

  for (const item of valid) {
    const name = getDmmItemSeriesName(item);
    if (!name) continue;

    const slug = slugify(name);
    if (!slug) continue;

    const makerName = getDmmItemMakerName(item);
    const existing = map.get(slug);

    map.set(slug, {
      name,
      slug,
      workCount: (existing?.workCount ?? 0) + 1,
      makerName: existing?.makerName ?? makerName,
      makerSlug:
        existing?.makerSlug ??
        (makerName ? slugify(makerName) : undefined),
    });
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export function getCatalogActresses(items: DmmItem[]): CatalogActressEntity[] {
  const valid = filterValidCatalogItems(items);
  const map = new Map<
    string,
    CatalogEntity & { ruby?: string }
  >();

  for (const item of valid) {
    for (const actress of iterateItemActresses(item)) {
      const slug = encodeActressSlug(actress.name);
      if (!slug) continue;

      const existing = map.get(actress.name);
      const ruby = actress.ruby?.trim();

      map.set(actress.name, {
        name: actress.name,
        slug,
        workCount: (existing?.workCount ?? 0) + 1,
        ruby: existing?.ruby ?? ruby,
      });
    }
  }

  const actresses = [...map.values()]
    .filter((actress) => actress.workCount >= 1)
    .sort(
      (a, b) =>
        b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
    );

  const imageByActress = buildActressRepresentativeImageMap(valid, actresses);

  return actresses.map((actress) => {
    const image = imageByActress.get(actress.name);

    return {
      name: actress.name,
      slug: actress.slug,
      workCount: actress.workCount,
      reading: getActressReading(actress.name, actress.ruby),
      imageUrl: image?.imageUrl,
      imageFromMultiActressWork: image?.isFromMultiActressWork,
    };
  });
}

export function getCatalogActressBySlug(
  items: DmmItem[],
  slug: string,
): CatalogActressEntity | undefined {
  const name = decodeActressSlug(slug);
  return getCatalogActresses(items).find(
    (actress) => actress.name === name || actress.slug === slug,
  );
}

export function getCatalogWorksByActressSlug(
  items: DmmItem[],
  slug: string,
): DmmItem[] {
  const actressName = decodeActressSlug(slug);

  return sortByCatalogOrder(
    items,
    filterValidCatalogItems(items).filter((item) => {
      return iterateItemActresses(item).some(
        (actress) =>
          actress.name === actressName ||
          matchesActressSlug(actress.name, slug),
      );
    }),
  );
}

export function getCatalogWorksByMakerSlug(
  items: DmmItem[],
  slug: string,
): DmmItem[] {
  return sortByCatalogOrder(
    items,
    filterValidCatalogItems(items).filter((item) => {
      const name = getDmmItemMakerName(item);
      return Boolean(name && slugify(name) === slug);
    }),
  );
}

export function getCatalogWorksByLabelSlug(
  items: DmmItem[],
  slug: string,
): DmmItem[] {
  return sortByCatalogOrder(
    items,
    filterValidCatalogItems(items).filter((item) => {
      const name = getDmmItemLabelName(item);
      return Boolean(name && slugify(name) === slug);
    }),
  );
}

export function getCatalogWorksBySeriesSlug(
  items: DmmItem[],
  slug: string,
): DmmItem[] {
  return sortByCatalogOrder(
    items,
    filterValidCatalogItems(items).filter((item) => {
      const name = getDmmItemSeriesName(item);
      return Boolean(name && slugify(name) === slug);
    }),
  );
}

export function getCatalogGenres(items: DmmItem[]): CatalogEntity[] {
  const valid = filterValidCatalogItems(items);
  const map = new Map<string, CatalogEntity>();

  for (const item of valid) {
    const genres = item.iteminfo?.genre ?? [];
    for (const genre of genres) {
      if (!genre.name) continue;

      const slug = slugify(genre.name);
      if (!slug) continue;

      const existing = map.get(slug);
      map.set(slug, {
        name: genre.name,
        slug,
        workCount: (existing?.workCount ?? 0) + 1,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
  );
}

export function getCatalogWorksByGenreSlug(
  items: DmmItem[],
  slug: string,
): DmmItem[] {
  return sortByCatalogOrder(
    items,
    filterValidCatalogItems(items).filter((item) => {
      const genres = item.iteminfo?.genre ?? [];
      return genres.some(
        (genre) => genre.name && slugify(genre.name) === slug,
      );
    }),
  );
}

function sortByCatalogOrder(
  catalog: DmmItem[],
  works: DmmItem[],
): DmmItem[] {
  const order = new Map(
    catalog.map((item, index) => [item.content_id, index]),
  );

  return [...works].sort(
    (a, b) =>
      (order.get(a.content_id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.content_id) ?? Number.MAX_SAFE_INTEGER),
  );
}

export async function getCatalogMakerStaticParams(): Promise<{ slug: string }[]> {
  const items = await getCatalogItems();
  return getCatalogMakers(items).map((maker) => ({
    slug: encodeEntitySlug(maker.slug),
  }));
}

export async function getCatalogLabelStaticParams(): Promise<{ slug: string }[]> {
  const items = await getCatalogItems();
  return getCatalogLabels(items).map((label) => ({
    slug: encodeEntitySlug(label.slug),
  }));
}

export async function getCatalogSeriesStaticParams(): Promise<{ slug: string }[]> {
  const items = await getCatalogItems();
  return getCatalogSeries(items).map((series) => ({
    slug: encodeEntitySlug(series.slug),
  }));
}

export async function getCatalogActressStaticParams(): Promise<{ slug: string }[]> {
  const items = await getCatalogItems();

  return getCatalogActresses(items)
    .filter(
      (actress) => getCatalogWorksByActressSlug(items, actress.slug).length > 0,
    )
    .map((actress) => ({ slug: actress.slug }));
}

export async function getCatalogGenreStaticParams(): Promise<{ slug: string }[]> {
  const items = await getCatalogItems();
  return getCatalogGenres(items).map((genre) => ({
    slug: encodeEntitySlug(genre.slug),
  }));
}
