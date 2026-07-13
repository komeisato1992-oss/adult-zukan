#!/usr/bin/env node
/** 同人カタログ検証（表示用JSON + rawシャード） */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const worksPath = path.join(root, "data/doujin/works.json");

const verify = spawnSync(
  process.execPath,
  ["scripts/split-doujin-raw-response.mjs", "verify"],
  { cwd: root, encoding: "utf8" },
);
process.stdout.write(verify.stdout || "");
process.stderr.write(verify.stderr || "");

const works = existsSync(worksPath)
  ? JSON.parse(readFileSync(worksPath, "utf8"))
  : [];
const inlineRaw = works.filter((w) => w.rawApiResponse != null).length;

console.log(
  JSON.stringify(
    {
      worksCount: works.length,
      worksJsonMb: existsSync(worksPath)
        ? Number((statSync(worksPath).size / 1024 / 1024).toFixed(3))
        : 0,
      inlineRawCount: inlineRaw,
      verifyExitCode: verify.status,
      ok: verify.status === 0 && inlineRaw === 0,
    },
    null,
    2,
  ),
);

process.exit(verify.status === 0 && inlineRaw === 0 ? 0 : 1);
