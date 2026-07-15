/**
 * FANZAジャケット等の縦長画像を枠内に cover する標準設定。
 * 顔が上部にあることが多いため right top を基準にする。
 * 変更時はこのファイルと app/globals.css の .image-cover を更新する。
 */
export const IMAGE_COVER_OBJECT_POSITION = "right top" as const;

/** className 用（CSS .image-cover + Tailwind フォールバック） */
export const imageCoverClassName =
  "image-cover object-cover object-[right_top]";

/** Next/Image の style 用 */
export const imageCoverStyle = {
  objectFit: "cover" as const,
  objectPosition: IMAGE_COVER_OBJECT_POSITION,
  maxWidth: "100%",
} as const;
