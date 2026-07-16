/**
 * NOW PRINTING 判定のスモークテスト（URL文字列優先・GET最小化）。
 * fetch をモックして「URLだけで判定できる作品は GET されない」ことを確認する。
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

function urlIndicatesNowPrinting(url) {
  if (url == null) return false;
  const normalized = String(url).trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes("now_printing") || normalized.includes("noimage")
  );
}

const KNOWN_NOW_PRINTING_SHA1 = new Set([
  "97d573a5b0cc474eb1e95265960b4a066f3aa4b7",
]);

function sha1Hex(buf) {
  return createHash("sha1").update(buf).digest("hex");
}

/** image-status.ts と同じ判定フロー（モック可能な fetch 付き） */
async function detectAdultImageStatus(url, fetchImpl) {
  const checkedAt = new Date().toISOString();
  const trimmed = url?.trim() || null;
  if (!trimmed) {
    return { status: "fetch_failed", fetched: false, finalUrl: null };
  }
  if (urlIndicatesNowPrinting(trimmed)) {
    return {
      status: "now_printing",
      fetched: false,
      finalUrl: trimmed,
      checkedAt,
    };
  }

  const res = await fetchImpl(trimmed, { redirect: "follow" });
  const finalUrl = res.url || trimmed;
  if (!res.ok) {
    return { status: "fetch_failed", fetched: true, finalUrl };
  }
  if (urlIndicatesNowPrinting(finalUrl)) {
    return { status: "now_printing", fetched: true, finalUrl };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (KNOWN_NOW_PRINTING_SHA1.has(sha1Hex(buf))) {
    return {
      status: "now_printing",
      fetched: true,
      finalUrl,
      bytes: buf.length,
    };
  }
  return { status: "ok", fetched: true, finalUrl, bytes: buf.length };
}

function pickFromImageURL(imageURL) {
  for (const key of ["large", "list", "small"]) {
    const v = imageURL?.[key]?.trim();
    if (v) return v;
  }
  return null;
}

let failed = 0;
let fetchCount = 0;

function assert(name, cond) {
  console.log(`${cond ? "OK" : "NG"} ${name}`);
  if (!cond) failed += 1;
}

const mockFetchOk = async (url) => {
  fetchCount += 1;
  return {
    ok: true,
    url,
    headers: { get: () => "image/jpeg" },
    arrayBuffer: async () => Buffer.from("real-package-image-bytes"),
  };
};

const mockFetchRedirectToNowPrinting = async () => {
  fetchCount += 1;
  return {
    ok: true,
    url: "https://pics.dmm.co.jp/digital/video/now_printing.jpg",
    headers: { get: () => "image/jpeg" },
    arrayBuffer: async () => Buffer.from("x"),
  };
};

// ① URLだけで判定 → GET されない
fetchCount = 0;
{
  const r = await detectAdultImageStatus(
    "https://pics.dmm.co.jp/digital/video/now_printing.jpg",
    mockFetchOk,
  );
  assert("URL now_printing → status", r.status === "now_printing");
  assert("URL now_printing → no GET", r.fetched === false && fetchCount === 0);
}
fetchCount = 0;
{
  const r = await detectAdultImageStatus(
    "https://pics.dmm.com/mono/noimage/adult.jpg",
    mockFetchOk,
  );
  assert("URL noimage → status", r.status === "now_printing");
  assert("URL noimage → no GET", r.fetched === false && fetchCount === 0);
}

// imageURL.large → list → small
{
  const url = pickFromImageURL({
    large: "https://pics.dmm.co.jp/digital/video/now_printing.jpg",
    list: "https://pics.dmm.co.jp/digital/video/abc/abcps.jpg",
    small: "https://pics.dmm.co.jp/digital/video/abc/abcjs.jpg",
  });
  fetchCount = 0;
  const r = await detectAdultImageStatus(url, mockFetchOk);
  assert("large 優先で now_printing", r.status === "now_printing");
  assert("large 判定で GET なし", fetchCount === 0);
}

// ② URL判定できない作品のみ GET
fetchCount = 0;
{
  const r = await detectAdultImageStatus(
    "https://pics.dmm.co.jp/digital/video/abc123/abc123pl.jpg",
    mockFetchOk,
  );
  assert("通常URL → ok", r.status === "ok");
  assert("通常URL → GET 1回", r.fetched === true && fetchCount === 1);
}

fetchCount = 0;
{
  const r = await detectAdultImageStatus(
    "https://pics.dmm.co.jp/digital/video/abc123/abc123pl.jpg",
    mockFetchRedirectToNowPrinting,
  );
  assert("リダイレクト最終URL → now_printing", r.status === "now_printing");
  assert("リダイレクト → GET あり", r.fetched === true && fetchCount === 1);
}

// ソースに参照URL一括取得が残っていないこと
const src = readFileSync(
  path.join(process.cwd(), "lib/works/image-status.ts"),
  "utf8",
);
assert("参照URL追加GETなし", !src.includes("REFERENCE_NOW_PRINTING_URLS"));
assert("ensureReferenceHashes なし", !src.includes("ensureReferenceHashes"));
assert("urlIndicatesNowPrinting 使用", src.includes("urlIndicatesNowPrinting"));
assert(
  "fetched: false で URL 早期 return",
  src.includes("fetched: false") && src.includes("urlIndicatesNowPrinting(trimmed)"),
);

const pkg = readFileSync(
  path.join(process.cwd(), "lib/works/package-image.ts"),
  "utf8",
);
assert(
  "urlIndicatesNowPrinting 定義",
  pkg.includes("export function urlIndicatesNowPrinting"),
);

if (failed > 0) {
  console.error(`FAILED ${failed}`);
  process.exit(1);
}
console.log("ALL PASSED");
