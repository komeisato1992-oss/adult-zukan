"use client";

import Image from "next/image";
import { useState } from "react";
import { DOUJIN_PLACEHOLDER_IMAGE } from "@/lib/doujin/format";

type DoujinCardImageProps = {
  src: string;
  alt: string;
  sizes?: string;
};

/**
 * 同人一覧カード用画像。
 * 枠内いっぱいに大きく表示しつつ、縦横比維持・トリミングなし（contain）。
 */
export function DoujinCardImage({
  src,
  alt,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
}: DoujinCardImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = failed || !src ? DOUJIN_PLACEHOLDER_IMAGE : src;

  return (
    <Image
      src={resolved}
      alt={alt}
      fill
      sizes={sizes}
      className="doujin-work-card__image"
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
