import type { DmmItem } from "@/lib/dmm/types";

const SAMPLE_MOVIE_SIZE_PRIORITY = [
  "size_720_480",
  "size_644_414",
  "size_560_360",
  "size_476_306",
] as const;

/** DMM APIの sampleMovieURL からブラウザ再生用URLを優先順位付きで取得 */
export function getDmmSampleMovieUrl(item: DmmItem): string | undefined {
  const movies = item.sampleMovieURL;
  if (!movies) return undefined;

  for (const key of SAMPLE_MOVIE_SIZE_PRIORITY) {
    const url = movies[key];
    if (typeof url === "string" && url.trim().length > 0) {
      return url.trim();
    }
  }

  return undefined;
}

/** videoタグで直接再生できるURLか判定（litevideo等のHTMLページは不可） */
export function canEmbedSampleMovieInBrowser(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    if (path.endsWith(".mp4") || path.endsWith(".webm") || path.endsWith(".m3u8")) {
      return true;
    }

    if (
      url.includes("litevideo") ||
      path.endsWith(".html") ||
      path.includes("/part/=")
    ) {
      return false;
    }

    return false;
  } catch {
    return false;
  }
}
