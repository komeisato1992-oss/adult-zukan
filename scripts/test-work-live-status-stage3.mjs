#!/usr/bin/env node
/**
 * Stage 3: 公開ページ向け live status 一括結合の静的検証
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

const files = {
  paginated: read("lib/works/paginated-work-list.ts"),
  search: read("lib/search/catalog.ts"),
  favorites: read("app/api/favorites/works/route.ts"),
  compare: read("app/api/compare/route.ts"),
  ranking: read("app/ranking/page.tsx"),
  weekly: read("app/ranking/weekly/page.tsx"),
  monthly: read("app/ranking/monthly/page.tsx"),
  rankingWorks: read("app/ranking/works/page.tsx"),
  actress: read("app/actresses/[slug]/page.tsx"),
  maker: read("app/makers/[slug]/page.tsx"),
  similar: read("lib/compare/get-similar-works.ts"),
  internal: read("lib/dmm/internal-links.ts"),
  runner: read("lib/admin/fanza-sync-runner.ts"),
  liveIndex: read("lib/dmm/work-live-status/index.ts"),
  dashboard: read("components/admin/WorksOpsDashboard.tsx"),
};

assert.match(files.paginated, /mergeLiveStatusIntoItems/);
assert.match(files.paginated, /async function getPaginatedWorkCardList/);
assert.match(files.search, /mergeLiveStatusIntoItems/);
assert.match(files.favorites, /mergeLiveStatusIntoItems/);
assert.doesNotMatch(files.favorites, /getCatalogWorkByContentId/);
assert.match(files.compare, /mergeLiveStatusIntoItems/);
assert.match(files.ranking, /mergeLiveStatusIntoItems/);
assert.match(files.weekly, /mergeLiveStatusIntoItems/);
assert.match(files.monthly, /mergeLiveStatusIntoItems/);
assert.match(files.rankingWorks, /await getPaginatedWorkCardListFromSorted/);
assert.match(files.actress, /mergeLiveStatusIntoItems/);
assert.match(files.maker, /await getPaginatedDisplayableWorkCardList/);
assert.match(files.similar, /mergeLiveStatusIntoItems/);
assert.match(files.internal, /mergeLiveStatusIntoItems/);
assert.match(files.runner, /revalidateWorkLiveStatusAfterSync/);
assert.match(files.liveIndex, /revalidateWorkLiveStatusAfterSync/);
assert.doesNotMatch(
  files.liveIndex,
  /upsertLiveStatusFromWorks[\s\S]{0,400}revalidateTag/,
);
assert.match(files.dashboard, /JSONフォールバック/);
assert.match(files.dashboard, /キャッシュHit率/);
assert.match(files.dashboard, /DB取得時間/);

const livePath = path.join(root, "data/dmm/work-live-status.json");
assert.ok(existsSync(livePath), "live status file exists for local backend");
const live = JSON.parse(readFileSync(livePath, "utf8"));
assert.ok(Object.keys(live.entries).length >= 100);

console.log("test-work-live-status-stage3: ok");
