#!/usr/bin/env node
/**
 * 同人作品の productFormatNormalized をバックフィルする。
 *
 * 用法:
 *   npm run doujin:backfill:format
 *   npm run doujin:backfill:format -- --dry-run
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDoujinProductFormat } from "../lib/doujin/product-format-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORKS_PATH = path.join(ROOT, "data/doujin/works.json");
const GENRES_PATH = path.join(ROOT, "data/doujin/genres.json");

const dryRun = process.argv.includes("--dry-run");

function main() {
  const works = JSON.parse(readFileSync(WORKS_PATH, "utf8"));
  const genres = JSON.parse(readFileSync(GENRES_PATH, "utf8"));
  const genreNameById = new Map(genres.map((genre) => [genre.id, genre.name]));

  const counts = {
    total: works.length,
    updated: 0,
    unchanged: 0,
    byFormat: {},
    unresolved: 0,
  };

  for (const work of works) {
    const genreNames = (work.genreIds ?? [])
      .map((id) => genreNameById.get(id))
      .filter(Boolean);
    const next =
      normalizeDoujinProductFormat({
        productFormat: work.productFormat,
        volume: work.volume,
        title: work.title,
        genreNames,
        rawApiResponse: work.rawApiResponse,
      }) ?? undefined;

    const prev = work.productFormatNormalized || undefined;
    if (prev === next) {
      counts.unchanged += 1;
    } else {
      if (next) work.productFormatNormalized = next;
      else delete work.productFormatNormalized;
      counts.updated += 1;
    }

    if (next) {
      counts.byFormat[next] = (counts.byFormat[next] ?? 0) + 1;
    } else {
      counts.unresolved += 1;
    }
  }

  if (!dryRun) {
    writeFileSync(WORKS_PATH, `${JSON.stringify(works, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify({ dryRun, ...counts }, null, 2));
}

main();
