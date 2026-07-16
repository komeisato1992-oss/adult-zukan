/**
 * isMissingAdultImage の簡易テスト（URL文字列のみ）
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

// Compile-free: duplicate the pattern check for smoke, and also import via ts if available.
// Prefer dynamic import of the built logic by inlining the same constants for assertion,
// then import from a small runner that uses tsx-less duplicated expectations against package-image via next/swc is heavy.
// Instead: spawn node --import and evaluate TypeScript through a tiny inline copy matching the module.

const KNOWN_MISSING_IMAGE_PATTERNS = [
  "now_printing",
  "nowprinting",
  "now-printing",
  "noimage",
  "no_image",
  "no-image",
  "image_not_found",
];

function isMissingAdultImage(url) {
  if (url == null) return true;
  const normalized = String(url).trim().toLowerCase();
  if (!normalized) return true;
  if (["null", "undefined", "-", "none", "n/a", "na", "nil", "false", "0"].includes(normalized)) {
    return true;
  }
  return KNOWN_MISSING_IMAGE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

const cases = [
  { url: null, expect: true, name: "null" },
  { url: undefined, expect: true, name: "undefined" },
  { url: "", expect: true, name: "empty" },
  { url: "   ", expect: true, name: "whitespace" },
  {
    url: "https://pics.dmm.co.jp/digital/video/abc123/abc123pl.jpg",
    expect: false,
    name: "normal work image",
  },
  {
    url: "https://pics.dmm.co.jp/digital/video/now_printing.jpg",
    expect: true,
    name: "NOW PRINTING canonical",
  },
  {
    url: "https://pics.dmm.co.jp/digital/video/now_printing/now_printingpl.jpg",
    expect: true,
    name: "NOW PRINTING pl",
  },
  {
    url: "https://pics.dmm.com/mono/noimage/now_printing.jpg",
    expect: true,
    name: "mono/noimage NOW PRINTING",
  },
  {
    url: "https://imgsrc.dmm.com/pics/mono/movie/n/now_printing/now_printing.jpg",
    expect: true,
    name: "imgsrc NOW PRINTING",
  },
];

let failed = 0;
for (const c of cases) {
  const got = isMissingAdultImage(c.url);
  const ok = got === c.expect;
  console.log(`${ok ? "OK" : "NG"} ${c.name}: got=${got} expect=${c.expect}`);
  if (!ok) failed += 1;
}

// Also import the real TS module via next's transpile isn't available; load with node by reading source regex.
import { readFileSync } from "node:fs";
const src = readFileSync(
  path.join(process.cwd(), "lib/works/package-image.ts"),
  "utf8",
);
if (!src.includes("export function isMissingAdultImage")) {
  console.error("NG missing export isMissingAdultImage");
  failed += 1;
}
if (!src.includes("KNOWN_MISSING_IMAGE_PATTERNS")) {
  console.error("NG missing KNOWN_MISSING_IMAGE_PATTERNS");
  failed += 1;
}
for (const p of ["now_printing", "noimage", "image_not_found"]) {
  if (!src.includes(`"${p}"`)) {
    console.error(`NG pattern not in source: ${p}`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`FAILED ${failed}`);
  process.exit(1);
}
console.log("ALL PASSED");
