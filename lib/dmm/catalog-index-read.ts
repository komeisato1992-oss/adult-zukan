import "server-only";

import { existsSync, readFileSync } from "fs";
import path from "path";
import { CATALOG_INDEX_PATHS } from "@/lib/dmm/index-paths";

type IndexEnvelope<T> = {
  items?: T[];
};

function readCatalogIndexItems<T>(relativePath: string): T[] {
  const filePath = path.join(process.cwd(), relativePath);
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as
      | T[]
      | IndexEnvelope<T>;
    return Array.isArray(raw) ? raw : (raw.items ?? []);
  } catch {
    return [];
  }
}

export type CatalogIndexNameEntry = {
  name: string;
  slug: string;
  workCount?: number;
};

export type CatalogIndexActressEntry = CatalogIndexNameEntry & {
  slug: string;
};

export function readCommittedActressIndex(): CatalogIndexActressEntry[] {
  return readCatalogIndexItems<CatalogIndexActressEntry>(
    CATALOG_INDEX_PATHS.actresses,
  );
}

export function readCommittedMakerIndex(): CatalogIndexNameEntry[] {
  return readCatalogIndexItems<CatalogIndexNameEntry>(
    CATALOG_INDEX_PATHS.makers,
  );
}

export function readCommittedLabelIndex(): CatalogIndexNameEntry[] {
  return readCatalogIndexItems<CatalogIndexNameEntry>(
    CATALOG_INDEX_PATHS.labels,
  );
}

export function readCommittedSeriesIndex(): CatalogIndexNameEntry[] {
  return readCatalogIndexItems<CatalogIndexNameEntry>(
    CATALOG_INDEX_PATHS.series,
  );
}

export function readCommittedGenreIndex(): CatalogIndexNameEntry[] {
  return readCatalogIndexItems<CatalogIndexNameEntry>(
    CATALOG_INDEX_PATHS.genres,
  );
}

export function readCommittedSearchIndexContentIds(): string[] {
  const items = readCatalogIndexItems<{ contentId: string }>(
    CATALOG_INDEX_PATHS.searchIndex,
  );
  return items
    .map((entry) => entry.contentId?.trim())
    .filter((id): id is string => Boolean(id));
}
