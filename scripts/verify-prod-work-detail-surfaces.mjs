#!/usr/bin/env node
/**
 * production モード / 本番URL向け 作品詳細・FANZA 検証
 *
 *   BASE_URL=http://localhost:3000 node scripts/verify-prod-work-detail-surfaces.mjs
 *   BASE_URL=https://adult-zukan.jp node scripts/verify-prod-work-detail-surfaces.mjs
 */

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const CONCURRENCY = Math.min(5, Number(process.env.CONCURRENCY ?? 3));
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const KNOWN_CIDS = [
  "13dsvr01779",
  "lulu00330",
  "same00207",
  "miab00561",
  "ajvr00301",
  "savr01089",
];

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

function extractWorkCids(html, limit = 12) {
  const cids = [];
  const seen = new Set();
  for (const m of html.matchAll(/\/works\/([a-z0-9_]+)/gi)) {
    const cid = m[1].toLowerCase();
    if (seen.has(cid)) continue;
    // filter out non-cid paths if any
    if (cid === "sale") continue;
    seen.add(cid);
    cids.push(cid);
    if (cids.length >= limit) break;
  }
  return cids;
}

function extractActressPath(html) {
  const m = html.match(/href="(\/actresses\/[^"?#]+)"/i);
  return m?.[1] || null;
}

async function checkDetail(cid) {
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
      (res.status === 200 &&
        /ページが見つかりません/.test(title) &&
        !/出演女優|作品情報/.test(title));
    const pageNotFound =
      res.status === 404 || /ページが見つかりません/.test(title);
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
    const okDetail =
      res.status === 200 &&
      !soft404 &&
      !pageNotFound &&
      Boolean(fanzaHref) &&
      fanzaEntry === 302 &&
      !doubleWrap;
    return {
      cid,
      url,
      status: res.status,
      soft404,
      pageNotFound,
      fanzaEntry,
      doubleWrap,
      okDetail,
      title: title.slice(0, 70),
    };
  } catch (err) {
    return {
      cid,
      url,
      status: 0,
      soft404: false,
      pageNotFound: false,
      fanzaEntry: null,
      doubleWrap: false,
      okDetail: false,
      error: String(err?.message || err),
    };
  }
}

async function fetchHtml(path) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ja" },
  });
  const html = await res.text();
  return { url, status: res.status, html };
}

function summarize(label, results) {
  const summary = {
    label,
    n: results.length,
    okDetail: results.filter((r) => r.okDetail).length,
    http200: results.filter((r) => r.status === 200).length,
    soft404: results.filter((r) => r.soft404).length,
    http404: results.filter((r) => r.status === 404 || r.pageNotFound).length,
    http500: results.filter((r) => r.status >= 500).length,
    fanza302: results.filter((r) => r.fanzaEntry === 302).length,
    fanza400: results.filter((r) => r.fanzaEntry === 400).length,
    doubleWrap: results.filter((r) => r.doubleWrap).length,
    failCids: results.filter((r) => !r.okDetail).map((r) => r.cid),
  };
  console.log(JSON.stringify(summary));
  return summary;
}

async function main() {
  console.log("=== prod surface verification ===");
  console.log(`BASE_URL=${BASE_URL}`);
  console.log(`CONCURRENCY=${CONCURRENCY}`);

  console.log("\n-- known CIDs --");
  const known = await mapPool(KNOWN_CIDS, CONCURRENCY, (cid) =>
    checkDetail(cid),
  );
  for (const r of known) {
    console.log(
      `${r.cid} status=${r.status} soft404=${r.soft404} fanza=${r.fanzaEntry} double=${r.doubleWrap} ok=${r.okDetail}`,
    );
  }
  const knownSummary = summarize("known", known);

  const surfaces = [
    { label: "home", path: "/" },
    { label: "ranking", path: "/ranking" },
    { label: "works", path: "/works?sort=popular" },
    { label: "search", path: "/search?q=%E3%81%BF%E3%81%B2%E3%81%AA" },
  ];

  const surfaceSummaries = [];
  for (const s of surfaces) {
    console.log(`\n-- surface ${s.label} ${s.path} --`);
    const page = await fetchHtml(s.path);
    console.log(`page status=${page.status}`);
    const cids = extractWorkCids(page.html, 8);
    console.log(`extracted cids=${cids.length}`, cids.join(","));
    if (cids.length === 0) {
      surfaceSummaries.push({
        label: s.label,
        n: 0,
        okDetail: 0,
        failCids: ["(no work links on page)"],
        pageStatus: page.status,
      });
      continue;
    }
    const results = await mapPool(cids, CONCURRENCY, (cid) => checkDetail(cid));
    for (const r of results) {
      console.log(
        `  ${r.cid} status=${r.status} soft404=${r.soft404} fanza=${r.fanzaEntry} ok=${r.okDetail}`,
      );
    }
    surfaceSummaries.push({
      ...summarize(s.label, results),
      pageStatus: page.status,
    });
  }

  // actress page: find from home or actresses index
  console.log("\n-- surface actress --");
  let actressPath = null;
  const actressesIndex = await fetchHtml("/actresses");
  actressPath = extractActressPath(actressesIndex.html);
  if (!actressPath) {
    const home = await fetchHtml("/");
    actressPath = extractActressPath(home.html);
  }
  let actressSummary = null;
  if (!actressPath) {
    console.log("no actress link found");
    actressSummary = {
      label: "actress",
      n: 0,
      okDetail: 0,
      failCids: ["(no actress link)"],
    };
  } else {
    console.log(`actress path=${actressPath}`);
    const actressPage = await fetchHtml(actressPath);
    console.log(`actress page status=${actressPage.status}`);
    const cids = extractWorkCids(actressPage.html, 8);
    console.log(`extracted cids=${cids.length}`, cids.join(","));
    const results = await mapPool(cids, CONCURRENCY, (cid) => checkDetail(cid));
    for (const r of results) {
      console.log(
        `  ${r.cid} status=${r.status} soft404=${r.soft404} fanza=${r.fanzaEntry} ok=${r.okDetail}`,
      );
    }
    actressSummary = {
      ...summarize("actress", results),
      pageStatus: actressPage.status,
      actressPath,
    };
  }

  const allFail = [
    ...knownSummary.failCids,
    ...surfaceSummaries.flatMap((s) => s.failCids || []),
    ...(actressSummary?.failCids || []),
  ].filter((c) => c && !String(c).startsWith("("));

  const ok =
    knownSummary.okDetail === knownSummary.n &&
    knownSummary.soft404 === 0 &&
    knownSummary.http404 === 0 &&
    knownSummary.fanza400 === 0 &&
    surfaceSummaries.every(
      (s) =>
        s.n > 0 &&
        s.okDetail === s.n &&
        (s.soft404 ?? 0) === 0 &&
        (s.http404 ?? 0) === 0 &&
        (s.fanza400 ?? 0) === 0,
    ) &&
    actressSummary &&
    actressSummary.n > 0 &&
    actressSummary.okDetail === actressSummary.n;

  console.log("\n======== FINAL ========");
  console.log(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        ok,
        known: knownSummary,
        surfaces: surfaceSummaries,
        actress: actressSummary,
        allFail,
      },
      null,
      2,
    ),
  );

  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
