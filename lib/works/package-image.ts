/**
 * パッケージ画像の有効判定（候補取得・追加・公開・一覧・管理画面で共有）
 *
 * URL文字列のみで判定する。
 * HEAD/GET・ハッシュ比較・類似画像判定・全件画像ダウンロードは行わない。
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
 * FANZA の NOW PRINTING / プレースホルダー画像URLから確認した判定パターン。
 *
 * 確認済み実URL例:
 * - https://pics.dmm.co.jp/digital/video/now_printing.jpg
 * - https://pics.dmm.co.jp/digital/video/now_printing/now_printingpl.jpg
 * - https://pics.dmm.co.jp/digital/video/now_printing/now_printingps.jpg
 * - https://pics.dmm.co.jp/mono/movie/adult/now_printing.jpg
 * - https://pics.dmm.co.jp/digital/now_printing.jpg
 * - https://pics.dmm.com/mono/noimage/now_printing.jpg
 * - https://imgsrc.dmm.com/pics/mono/movie/n/now_printing/now_printing.jpg
 */
export const KNOWN_MISSING_IMAGE_PATTERNS = [
  "now_printing",
  "nowprinting",
  "now-printing",
  "noimage",
  "no_image",
  "no-image",
  "image_not_found",
] as const;

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

/**
 * アダルト図鑑の「画像なし」判定（公開・管理で共通）。
 * null / undefined / 空 / 既知プレースホルダーURL を画像なしとする。
 */
export function isMissingAdultImage(url?: string | null): boolean {
  if (url == null) return true;

  const normalized = String(url).trim().toLowerCase();
  if (!normalized) return true;
  if (INVALID_LITERALS.has(normalized)) return true;

  return KNOWN_MISSING_IMAGE_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

/** @deprecated isMissingAdultImage を使う */
export function isDmmDummyPackageImageUrl(url: string): boolean {
  return isMissingAdultImage(url);
}

function normalizeCandidate(raw: string | null | undefined): string | null {
  if (isMissingAdultImage(raw)) return null;
  return String(raw).trim();
}

/** 単一URLが実際のパッケージ画像として有効か */
export function isValidImageUrl(url?: string | null): boolean {
  if (isMissingAdultImage(url)) return false;

  const trimmed = String(url).trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
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
 * isMissingAdultImage() と同じプレースホルダー判定を使う。
 */
export function hasValidPackageImage(work: PackageImageSource): boolean {
  return resolvePackageImageUrl(work) != null;
}
