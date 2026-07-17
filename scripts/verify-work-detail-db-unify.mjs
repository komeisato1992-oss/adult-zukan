#!/usr/bin/env node
/**
 * 作品詳細 DB 統一 / FANZA 二重ラップ修正の検証（読み取り専用）
 *
 * 実行:
 *   BASE_URL=http://localhost:3000 node scripts/verify-work-detail-db-unify.mjs
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    const key = s.slice(0, i).trim();
    const value = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(resolve(root, ".env.local"));
loadEnv(resolve(root, ".env"));

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const CONCURRENCY = Math.min(5, Number(process.env.CONCURRENCY ?? 3));
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Resolve FANZA via compiled TS through jiti if available, else inline
function resolveFanzaAffiliateUrl({ affiliateUrl, productUrl }) {
  const FANZA_LINK_AFFILIATE_ID =
    process.env.DMM_FANZA_LINK_AFFILIATE_ID ?? "zukanjp-001";
  const DMM_API_AFFILIATE_ID_FALLBACK = "zukanjp-990";
  const AFFILIATE_HOSTS = new Set(["al.dmm.co.jp", "al.fanza.co.jp"]);
  const candidates = [affiliateUrl, productUrl]
    .map((v) => v?.trim() || "")
    .filter(Boolean);
  for (const raw of candidates) {
    try {
      const u = new URL(raw);
      if (AFFILIATE_HOSTS.has(u.hostname.toLowerCase())) {
        return raw
          .split(DMM_API_AFFILIATE_ID_FALLBACK)
          .join(FANZA_LINK_AFFILIATE_ID);
      }
    } catch {
      /* ignore */
    }
  }
  for (const raw of candidates) {
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase();
      if (
        host === "video.dmm.co.jp" ||
        host === "www.dmm.co.jp" ||
        host === "www.dmm.com" ||
        host.endsWith(".dmm.co.jp") ||
        host.endsWith(".dmm.com")
      ) {
        if (AFFILIATE_HOSTS.has(host)) continue;
        return `https://al.dmm.co.jp/?lurl=${encodeURIComponent(raw)}&af_id=${FANZA_LINK_AFFILIATE_ID}&ch=api`;
      }
    } catch {
      /* ignore */
    }
  }
  return "";
}

function isVr({ cid, title, genres }) {
  if (cid?.toLowerCase().startsWith("vr")) return true;
  if (title?.includes("【VR】") || title?.includes("[VR]")) return true;
  return (genres ?? []).some((g) =>
    /VR/i.test(typeof g === "string" ? g : g?.name),
  );
}

function tokyoToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

async function checkPage(cid) {
  const url = `${BASE_URL}/works/${encodeURIComponent(cid)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ja" },
      redirect: "follow",
    });
    const html = await res.text();
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] || "";
    const soft404 =
      /作品が見つかりません/.test(title) ||
      (/作品が見つかりません/.test(html) && res.status === 200);
    const hrefMatch = html.match(
      /href="(https:\/\/al\.(?:dmm|fanza)\.co\.jp[^"]+)"/i,
    );
    const fanzaHref = hrefMatch
      ? hrefMatch[1].replace(/&amp;/g, "&")
      : null;
    let fanzaEntry = null;
    let doubleWrap = false;
    if (fanzaHref) {
      try {
        const lurl = new URL(fanzaHref).searchParams.get("lurl") || "";
        doubleWrap = /al\.(dmm|fanza)\.co\.jp/i.test(lurl);
      } catch {
        /* ignore */
      }
      const fr = await fetch(fanzaHref, {
        redirect: "manual",
        headers: { "User-Agent": UA },
      });
      fanzaEntry = fr.status;
    }
    return {
      cid,
      url,
      status: res.status,
      soft404,
      title: title.slice(0, 80),
      fanzaHref,
      fanzaEntry,
      doubleWrap,
      okDetail: res.status === 200 && !soft404 && !/ページが見つかりません/.test(html),
    };
  } catch (err) {
    return {
      cid,
      url,
      status: 0,
      soft404: false,
      error: String(err?.message || err),
      okDetail: false,
      fanzaHref: null,
      fanzaEntry: null,
      doubleWrap: false,
    };
  }
}

function seededShuffle(arr, seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const j = Math.abs(h) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function main() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    "";
  if (!url || !serviceKey) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(1);
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("=== verify work-detail DB unify ===");
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`CONCURRENCY=${CONCURRENCY}`);

  // ---- DB integrity (no HTTP to all works) ----
  const livePool = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await client
      .from("work_live_status")
      .select("cid,is_available,is_sale,popularity_rank,new_arrival_rank")
      .eq("is_available", true)
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    livePool.push(...data);
    if (data.length < 1000) break;
  }
  const liveMap = new Map(livePool.map((r) => [r.cid, r]));
  const availableCids = livePool.map((r) => r.cid);

  const works = [];
  for (let i = 0; i < availableCids.length; i += 200) {
    const part = availableCids.slice(i, i + 200);
    const { data, error } = await client
      .from("works")
      .select(
        "cid,title,maker,genres,affiliate_url,published,release_date,image_status",
      )
      .in("cid", part)
      .eq("published", true);
    if (error) throw error;
    works.push(...(data ?? []));
  }

  const today = tokyoToday();
  const publicWorks = works.filter((w) => {
    if (w.image_status && w.image_status !== "ok") return false;
    if (w.release_date && String(w.release_date).slice(0, 10) > today) {
      return false;
    }
    return Boolean(liveMap.get(w.cid)?.is_available);
  });

  const cidSet = new Set();
  let cidMissing = 0;
  let cidDup = 0;
  for (const w of works) {
    if (!w.cid?.trim()) cidMissing++;
    else if (cidSet.has(w.cid)) cidDup++;
    else cidSet.add(w.cid);
  }

  let affiliateBad = 0;
  let affiliateOkTracker = 0;
  let affiliateOkProduct = 0;
  let affiliateEmpty = 0;
  let wouldDoubleWrapOld = 0;
  let resolveOk = 0;
  let resolveEmpty = 0;
  for (const w of publicWorks) {
    const a = w.affiliate_url?.trim() || "";
    if (!a) {
      affiliateEmpty++;
      resolveEmpty++;
      continue;
    }
    try {
      const host = new URL(a).hostname.toLowerCase();
      if (host === "al.dmm.co.jp" || host === "al.fanza.co.jp") {
        affiliateOkTracker++;
        wouldDoubleWrapOld++;
      } else if (
        host.includes("dmm.co.jp") ||
        host.includes("dmm.com")
      ) {
        affiliateOkProduct++;
      } else {
        affiliateBad++;
      }
    } catch {
      affiliateBad++;
    }
    const resolved = resolveFanzaAffiliateUrl({
      affiliateUrl: a,
      productUrl: a,
    });
    if (!resolved) resolveEmpty++;
    else {
      resolveOk++;
      try {
        const lurl = new URL(resolved).searchParams.get("lurl") || "";
        if (/al\.(dmm|fanza)\.co\.jp/i.test(lurl)) {
          // still double — count as bad
          affiliateBad++;
          resolveOk--;
        }
      } catch {
        /* ignore */
      }
    }
  }

  console.log("\n======== DB integrity ========");
  console.log({
    availableLive: livePool.length,
    publishedJoined: works.length,
    publicListableApprox: publicWorks.length,
    cidMissing,
    cidDup,
    affiliateEmpty,
    affiliateOkTracker,
    affiliateOkProduct,
    affiliateBadForm: affiliateBad,
    oldLogicWouldDoubleWrap: wouldDoubleWrapOld,
    newResolveOk: resolveOk,
    newResolveEmpty: resolveEmpty,
  });

  // ---- Known problem CIDs ----
  const known = [
    "13dsvr01779",
    "lulu00330",
    "same00207",
    "miab00561",
    "ajvr00301",
    "savr01089",
  ];

  console.log("\n======== known CIDs ========");
  const knownResults = await mapPool(known, CONCURRENCY, async (cid) => {
    const w = publicWorks.find((x) => x.cid === cid);
    const page = await checkPage(cid);
    console.log(
      cid,
      "dbPublic=",
      Boolean(w),
      "status=",
      page.status,
      "soft404=",
      page.soft404,
      "ok=",
      page.okDetail,
      "fanza=",
      page.fanzaEntry,
      "double=",
      page.doubleWrap,
    );
    return { cid, dbPublic: Boolean(w), ...page };
  });

  // ---- Samples ----
  const seed = process.env.SEED || today;
  const random100 = seededShuffle(publicWorks, seed).slice(0, 100);
  const vr50 = seededShuffle(
    publicWorks.filter((w) =>
      isVr({
        cid: w.cid,
        title: w.title,
        genres: w.genres,
      }),
    ),
    seed + ":vr",
  ).slice(0, 50);
  const ranking50 = [...publicWorks]
    .filter((w) => (liveMap.get(w.cid)?.popularity_rank ?? 0) > 0)
    .sort(
      (a, b) =>
        (liveMap.get(a.cid)?.popularity_rank ?? 999999) -
        (liveMap.get(b.cid)?.popularity_rank ?? 999999),
    )
    .slice(0, 50);
  const new50 = [...publicWorks]
    .sort((a, b) =>
      String(b.release_date || "").localeCompare(String(a.release_date || "")),
    )
    .slice(0, 50);
  const sale50 = publicWorks
    .filter((w) => liveMap.get(w.cid)?.is_sale)
    .slice(0, 50);

  async function checkSample(label, rows) {
    console.log(`\n======== ${label} (n=${rows.length}) ========`);
    const results = await mapPool(rows, CONCURRENCY, async (w, idx) => {
      process.stderr.write(`\r${label} ${idx + 1}/${rows.length}`);
      return { ...w, ...(await checkPage(w.cid)) };
    });
    process.stderr.write("\n");
    const summary = {
      label,
      n: results.length,
      okDetail: results.filter((r) => r.okDetail).length,
      soft404: results.filter((r) => r.soft404).length,
      http404: results.filter((r) => r.status === 404).length,
      http500: results.filter((r) => r.status >= 500).length,
      fanza400: results.filter((r) => r.fanzaEntry === 400).length,
      fanza302: results.filter((r) => r.fanzaEntry === 302).length,
      fanzaMissing: results.filter((r) => r.okDetail && !r.fanzaHref).length,
      doubleWrap: results.filter((r) => r.doubleWrap).length,
    };
    console.log(summary);
    return { summary, results };
  }

  const random = await checkSample("random100", random100);
  const vr = await checkSample("vr50", vr50);
  const ranking = await checkSample("ranking50", ranking50);
  const newest = await checkSample("new50", new50);
  const sale = await checkSample("sale50", sale50);

  // List page FANZA double-wrap check
  console.log("\n======== list/home FANZA ========");
  for (const path of ["/", "/works?sort=popular"]) {
    const html = await fetch(`${BASE_URL}${path}`, {
      headers: { "User-Agent": UA },
    }).then((r) => r.text());
    const hrefs = [
      ...html.matchAll(/href="(https:\/\/al\.(?:dmm|fanza)\.co\.jp[^"]+)"/gi),
    ].map((m) => m[1].replace(/&amp;/g, "&"));
    let double = 0;
    let fanza400 = 0;
    for (const h of hrefs.slice(0, 5)) {
      const lurl = new URL(h).searchParams.get("lurl") || "";
      if (/al\.(dmm|fanza)\.co\.jp/i.test(lurl)) double++;
      const st = (
        await fetch(h, { redirect: "manual", headers: { "User-Agent": UA } })
      ).status;
      if (st === 400) fanza400++;
      console.log(path, "fanza", st, "double=", /al\.(dmm|fanza)/i.test(lurl));
    }
    console.log(path, { hrefs: hrefs.length, sampleDouble: double, sample400: fanza400 });
  }

  const out = {
    baseUrl: BASE_URL,
    db: {
      publicListableApprox: publicWorks.length,
      cidMissing,
      cidDup,
      affiliateEmpty,
      affiliateOkTracker,
      affiliateOkProduct,
      affiliateBad,
      oldLogicWouldDoubleWrap: wouldDoubleWrapOld,
      newResolveOk: resolveOk,
    },
    known: knownResults,
    samples: {
      random: random.summary,
      vr: vr.summary,
      ranking: ranking.summary,
      new: newest.summary,
      sale: sale.summary,
    },
  };
  writeFileSync(
    resolve(root, "tmp-verify-work-detail-db-unify.json"),
    JSON.stringify(out, null, 2),
  );
  console.log("\nWrote tmp-verify-work-detail-db-unify.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
