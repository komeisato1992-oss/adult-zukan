import "server-only";

import { existsSync, readFileSync } from "fs";
import path from "path";
import type { FanzaExpandSource } from "@/lib/admin/fanza-expand-types";

type EntityIndexFile = {
  items?: Array<{ name?: string; workCount?: number }>;
};

const ENTITY_FILES: Partial<Record<FanzaExpandSource, string>> = {
  genre: "data/dmm/genres.json",
  maker: "data/dmm/makers.json",
  label: "data/dmm/labels.json",
  series: "data/dmm/series.json",
  actress: "data/dmm/actresses.json",
};

function loadEntityNames(relativePath: string): string[] {
  const filePath = path.join(process.cwd(), relativePath);
  if (!existsSync(filePath)) return [];
  try {
    const data = JSON.parse(readFileSync(filePath, "utf8")) as EntityIndexFile;
    const items = Array.isArray(data.items) ? data.items : [];
    return items
      .map((item) => ({
        name: String(item.name ?? "").trim(),
        workCount: Number(item.workCount ?? 0),
      }))
      .filter((item) => item.name.length > 0)
      .sort(
        (a, b) =>
          b.workCount - a.workCount || a.name.localeCompare(b.name, "ja"),
      )
      .map((item) => item.name);
  } catch (error) {
    console.warn(`[fanza-expand] failed to load ${relativePath}`, error);
    return [];
  }
}

const cache = new Map<FanzaExpandSource, string[]>();

/** ジャンル / メーカー / レーベル / シリーズ / 女優の keyword 種を返す */
export function getFanzaExpandEntityNames(
  source: FanzaExpandSource,
): string[] {
  if (source === "popular" || source === "new") return [];
  const cached = cache.get(source);
  if (cached) return cached;
  const relative = ENTITY_FILES[source];
  if (!relative) return [];
  const names = loadEntityNames(relative);
  cache.set(source, names);
  return names;
}

export function isKeywordExpandSource(source: FanzaExpandSource): boolean {
  return (
    source === "genre" ||
    source === "maker" ||
    source === "label" ||
    source === "series" ||
    source === "actress"
  );
}

export function expandSourceSort(
  source: FanzaExpandSource,
): "rank" | "date" {
  return source === "new" ? "date" : "rank";
}

export function expandSourceLabel(source: FanzaExpandSource): string {
  switch (source) {
    case "popular":
      return "人気順";
    case "new":
      return "新着順";
    case "genre":
      return "ジャンル";
    case "maker":
      return "メーカー";
    case "label":
      return "レーベル";
    case "series":
      return "シリーズ";
    case "actress":
      return "女優";
    default:
      return source;
  }
}
