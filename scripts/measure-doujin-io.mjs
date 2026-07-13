#!/usr/bin/env node
/**
 * 同人カタログ I/O 計測（変更なし保存スキップ含む）。
 * PERFORMANCE_DEBUG は不要。秘密情報は出さない。
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const worksPath = path.join(root, "data/doujin/works.json");

const t0 = performance.now();
const text = readFileSync(worksPath, "utf8");
const t1 = performance.now();
const works = JSON.parse(text);
const t2 = performance.now();
JSON.stringify(works);
const t3 = performance.now();
const withRaw = works.filter((w) => w.rawApiResponse != null).length;

console.log(
  JSON.stringify(
    {
      worksCount: works.length,
      bytes: statSync(worksPath).size,
      mb: Number((statSync(worksPath).size / 1024 / 1024).toFixed(3)),
      inlineRawCount: withRaw,
      readMs: Number((t1 - t0).toFixed(1)),
      parseMs: Number((t2 - t1).toFixed(1)),
      stringifyMs: Number((t3 - t2).toFixed(1)),
      expectedImportIoPerRequest: {
        loads: 1,
        savesMax: 1,
        note: "batched import uses 1 load + 1 save per HTTP tick",
      },
    },
    null,
    2,
  ),
);
