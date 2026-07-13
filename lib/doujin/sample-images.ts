/**
 * 同人作品のサンプル画像URL整形。
 * APIから返ったHTTPS URLのみ許可。推測生成・文字列置換はしない。
 */

const COVER_SUFFIX_PATTERN = /p[lts]\.jpe?g(?:\?|$)/i;

export function isAllowedDoujinSampleImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    // javascript:/data: 等は URL パースで弾かれる想定だが念のため
    if (!/^[\w.-]+\.[a-z]{2,}$/i.test(parsed.hostname) && !parsed.hostname.includes(".")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 完全一致の重複を除き、HTTPS URLのみ残す。
 * 表紙（〜pl/pt/ps.jpg）と同一URLはサンプル一覧から除外する。
 */
export function sanitizeDoujinSampleImageUrls(
  urls: string[] | undefined | null,
  coverUrls: Array<string | undefined | null> = [],
): string[] {
  if (!urls?.length) return [];

  const coverSet = new Set(
    coverUrls
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  );

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of urls) {
    if (typeof raw !== "string") continue;
    const url = raw.trim();
    if (!isAllowedDoujinSampleImageUrl(url)) continue;
    if (coverSet.has(url)) continue;
    // 表紙系ファイル名そのものはサンプルではない（万一混入した場合）
    if (COVER_SUFFIX_PATTERN.test(url) && !/jp-\d+/i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }

  return result;
}

/**
 * sampleImageURL オブジェクトから、最初に見つかった非空セットのみを返す。
 * 優先: sample_l → sample → sample_s（API順を維持）
 */
export function extractDoujinSampleImageUrlsFromApi(
  sampleImageURL: unknown,
): string[] {
  if (!sampleImageURL || typeof sampleImageURL !== "object") return [];

  const sample = sampleImageURL as Record<string, unknown>;
  for (const key of ["sample_l", "sample", "sample_s"] as const) {
    const set = sample[key];
    if (!set || typeof set !== "object" || Array.isArray(set)) continue;
    const images = (set as { image?: unknown }).image;
    const list = Array.isArray(images)
      ? images
      : typeof images === "string"
        ? [images]
        : [];
    const urls = list
      .filter((image): image is string => typeof image === "string")
      .map((image) => image.trim())
      .filter(Boolean);
    if (urls.length > 0) {
      return sanitizeDoujinSampleImageUrls(urls);
    }
  }

  return [];
}
