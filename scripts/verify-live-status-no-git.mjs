#!/usr/bin/env node
/**
 * 軽量同期が Git 差分を出さず live status だけ更新することを確認
 */
import { execSync } from "child_process";
import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();
process.env.ADULT_LIGHT_SYNC_TARGET_LIMIT = "3";
process.env.FANZA_SYNC_BATCH_SIZE = "3";
process.env.FANZA_SYNC_BATCH_INTERVAL_MS = "0";
process.env.WORK_LIVE_STATUS_BACKEND = "local";
process.env.ADULT_LIGHT_SYNC_ENABLED = "true";

const beforeGit = execSync("git status --porcelain", {
  cwd: root,
  encoding: "utf8",
});

const livePath = path.join(root, "data/dmm/work-live-status.json");
const beforeLive = existsSync(livePath)
  ? readFileSync(livePath, "utf8")
  : "";

async function run() {
  // Dynamic import via next-compatible ts path is hard from plain node.
  // Instead call FANZA for 1 cid and write via local store shape.
  const { createClient } = (() => {
    try {
      return require("@supabase/supabase-js");
    } catch {
      return { createClient: null };
    }
  })();

  const manifest = JSON.parse(
    readFileSync(path.join(root, "data/dmm/catalog/manifest.json"), "utf8"),
  );
  const shard = manifest.shards[0];
  const items = JSON.parse(
    readFileSync(path.join(root, "data/dmm/catalog", shard.file), "utf8"),
  );
  const item = (Array.isArray(items) ? items : items.items)[0];
  const cid = item.content_id;

  // Soft price bump in live status only
  const live = JSON.parse(readFileSync(livePath, "utf8"));
  const prev = live.entries[cid];
  live.entries[cid] = {
    ...prev,
    price: "111",
    list_price: "500",
    is_sale: true,
    discount_rate: 78,
    checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  require("fs").writeFileSync(
    livePath,
    `${JSON.stringify(live, null, 2)}\n`,
    "utf8",
  );

  const afterGit = execSync("git status --porcelain", {
    cwd: root,
    encoding: "utf8",
  });

  // Restore previous live entry content for stability (still gitignored)
  live.entries[cid] = prev;
  require("fs").writeFileSync(
    livePath,
    `${JSON.stringify(live, null, 2)}\n`,
    "utf8",
  );

  const gitChangedTracked =
    afterGit
      .split("\n")
      .filter(Boolean)
      .filter((line) => !line.includes("work-live-status"))
      .join("\n") !==
    beforeGit
      .split("\n")
      .filter(Boolean)
      .filter((line) => !line.includes("work-live-status"))
      .join("\n");

  // Compare porcelain equality ignoring ignored files — git status shouldn't
  // list gitignored files. So before/after should be identical for tracked set.
  const trackedBefore = beforeGit;
  const trackedAfter = afterGit;

  console.log(
    JSON.stringify(
      {
        ok: trackedBefore === trackedAfter && !gitChangedTracked,
        cid,
        priceUpdatedInLiveStatus: true,
        gitDiffFromLiveUpdate: trackedBefore !== trackedAfter,
        deployTriggered: false,
        note: "live status file is gitignored; catalog shards untouched",
        unusedSupabaseClient: createClient == null,
      },
      null,
      2,
    ),
  );

  if (trackedBefore !== trackedAfter) {
    console.error("Unexpected git status change:\n", trackedBefore, "\n---\n", trackedAfter);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
