import { DOUJIN_PLACEHOLDER_IMAGE } from "@/lib/doujin/format";
import type { DoujinWork } from "@/lib/doujin/types";

export type DoujinCardImageSource = Pick<
  DoujinWork,
  "imageUrl" | "imageListUrl" | "imageLargeUrl" | "sampleImageUrls"
> & {
  imageSmallUrl?: string;
};

/**
 * FANZA同人の imageURL.list (〜pt.jpg) は 90×90 の中央切り抜きが多く、
 * 顔・タイトル文字が欠けた状態で返る。カードでは使わない。
 */
function isCroppedSquareListUrl(url: string): boolean {
  // 例: .../d_769712pt.jpg （list） / ...ps.jpg （small）
  return /p[ts]\.jpe?g(?:\?|$)/i.test(url);
}

/**
 * 同人一覧カード向け画像URL。
 * 作品全体が写っている大きめ画像を優先（切り抜き正方形は除外）。
 * large → list(非crop) → sample先頭 → small → imageUrl → プレースホルダー
 * APIから返ったURLのみ使用（推測置換なし）
 */
export function getDoujinCardImage(work: DoujinCardImageSource): string {
  const candidates = [
    work.imageLargeUrl,
    work.imageListUrl,
    work.sampleImageUrls?.[0],
    work.imageSmallUrl,
    work.imageUrl,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    if (isCroppedSquareListUrl(trimmed)) continue;
    return trimmed;
  }

  return DOUJIN_PLACEHOLDER_IMAGE;
}

/** 作品形式ラベル（カード左上） */
export function getDoujinFormatLabel(productFormat?: string): string | null {
  const raw = productFormat?.trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  if (normalized.includes("comic") || raw.includes("コミック")) return "コミック";
  if (normalized.includes("cg") || raw.includes("CG")) return "CG";
  if (normalized.includes("voice") || raw.includes("音声")) return "音声";
  if (normalized.includes("game") || raw.includes("ゲーム")) return "ゲーム";
  if (normalized.includes("video") || raw.includes("動画")) return "動画";
  if (raw.includes("電子書籍")) return "コミック";

  // 長すぎる場合は省略せずそのまま短く使う
  return raw.length > 12 ? `${raw.slice(0, 12)}…` : raw;
}
