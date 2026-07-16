/**
 * パッケージ画像の有効判定（候補取得・追加・公開・一覧で共有）
 *
 * 「URLがある」だけでは不十分。DMMのダミー画像は画像なし扱い。
 */

const IMAGE_EXTENSIONS = /\.(jpe?g|webp|png|gif)(\?|#|$)/i;

const INVALID_LITERALS = new Set([
  "",
  "-",
  "—",
  "–",
  "null",
  "undefined",
  "none",
  "n/a",
  "na",
  "nil",
  "false",
  "0",
]);

/**
 * URL全体に含まれるダミー / プレースホルダーキーワード。
 * now_printing・noimage・placeholder・dummy・blank・sampleなし 系を含む。
 */
const INVALID_IMAGE_KEYWORDS = [
  "now_printing",
  "nowprinting",
  "now-printing",
  "noimage",
  "no_image",
  "no-image",
  "img_noimage",
  "placeholder",
  "dummy",
  "blank",
  "broken",
  "missing",
  "default_jacket",
  "coming_soon",
  "comingssoon",
  "nosample",
  "no_sample",
  "no-sample",
  "without_sample",
  "sample_none",
  "samplenone",
  "no_jacket",
  "nojacket",
  "preparing",
  "under_construction",
] as const;

/** ファイル名（basename）がこれに一致/前方一致ならダミー */
const INVALID_BASENAME_PATTERNS = [
  /^now[_-]?printing/i,
  /^no[_-]?image/i,
  /^placeholder/i,
  /^dummy/i,
  /^blank/i,
  /^empty/i,
  /^default/i,
  /^coming[_-]?soon/i,
  /^no[_-]?sample/i,
  /^nosample/i,
  /^camera\.jpe?g$/i,
  /^printing\.jpe?g$/i,
] as const;

/** パスのディレクトリ名がダミー用 */
const INVALID_PATH_SEGMENTS = new Set([
  "now_printing",
  "nowprinting",
  "noimage",
  "no_image",
  "placeholder",
  "dummy",
  "blank",
  "nosample",
  "no_sample",
]);

export type PackageImageSource =
  | string
  | null
  | undefined
  | {
      package_image?: string | null;
      packageImage?: string | null;
      imageUrl?: string | null;
      imageURL?: {
        large?: string | null;
        list?: string | null;
        small?: string | null;
      } | null;
    };

function normalizeCandidate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (INVALID_LITERALS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/** DMM/FANZA のダミーパッケージ画像URLか */
export function isDmmDummyPackageImageUrl(url: string): boolean {
  const lower = url.toLowerCase();

  if (INVALID_IMAGE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return true;
  }

  let pathname = lower;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    // keep lower as pathname fallback
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.some((seg) => INVALID_PATH_SEGMENTS.has(seg))) {
    return true;
  }

  const basename = segments[segments.length - 1] ?? "";
  const file = basename.split("?")[0] ?? "";
  if (INVALID_BASENAME_PATTERNS.some((re) => re.test(file))) {
    return true;
  }

  // now_printingpl.jpg / noimageps.jpg などサイズ接尾辞付き
  if (/^(now[_-]?printing|no[_-]?image|dummy|blank|placeholder)/i.test(file)) {
    return true;
  }

  return false;
}

/** 単一URLが実際のパッケージ画像として有効か */
export function isValidImageUrl(url?: string | null): boolean {
  const trimmed = normalizeCandidate(url);
  if (!trimmed) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  if (isDmmDummyPackageImageUrl(trimmed)) {
    return false;
  }

  // DMM/FANZA の実画像は拡張子付き。拡張子なしは無効扱い
  if (
    !IMAGE_EXTENSIONS.test(parsed.pathname) &&
    !IMAGE_EXTENSIONS.test(trimmed)
  ) {
    return false;
  }

  return true;
}

/**
 * work / package_image 文字列から有効な画像URLを解決する。
 * package_image → packageImage → imageUrl → imageURL.large/list/small の順。
 * ダミー画像はスキップする。
 */
export function resolvePackageImageUrl(
  work: PackageImageSource,
  order: Array<"large" | "list" | "small"> = ["large", "list", "small"],
): string | null {
  if (work == null) return null;

  if (typeof work === "string") {
    return isValidImageUrl(work) ? work.trim() : null;
  }

  const directCandidates = [
    work.package_image,
    work.packageImage,
    work.imageUrl,
  ];
  for (const candidate of directCandidates) {
    const normalized = normalizeCandidate(candidate);
    if (normalized && isValidImageUrl(normalized)) {
      return normalized;
    }
  }

  const imageURL = work.imageURL;
  if (imageURL) {
    for (const key of order) {
      const normalized = normalizeCandidate(imageURL[key]);
      if (normalized && isValidImageUrl(normalized)) {
        return normalized;
      }
    }
  }

  return null;
}

/**
 * 実際の作品パッケージ画像があるかどうか。
 * - null / 空 / 空白のみ / "undefined"|"null"|"-" は無効
 * - http(s) 以外は無効
 * - now_printing / noimage / placeholder / dummy / blank / sampleなし 等のダミーは無効
 */
export function hasValidPackageImage(work: PackageImageSource): boolean {
  return resolvePackageImageUrl(work) != null;
}
