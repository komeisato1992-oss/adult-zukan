"use client";

import Image from "next/image";
import { useState } from "react";
import {
  imageCoverClassName,
  imageCoverStyle,
} from "@/components/ui/image-cover";

const VARIANTS = {
  landscape: {
    frameClass: "work-image-frame work-image-frame--landscape aspect-[3/2]",
    defaultSizes: "(max-width: 389px) 50vw, (max-width: 768px) 33vw, 25vw",
  },
  portrait: {
    frameClass: "work-image-frame work-image-frame--portrait aspect-[2/3]",
    defaultSizes: "(max-width: 389px) 50vw, (max-width: 768px) 33vw, 25vw",
  },
} as const;

type CatalogWorkImageProps = {
  src: string;
  alt: string;
  variant?: keyof typeof VARIANTS;
  priority?: boolean;
  loading?: "lazy" | "eager";
  sizes?: string;
  frameClassName?: string;
  /** 読み込み失敗時（DBは更新しない）。親カード非表示などに使う */
  onLoadError?: () => void;
};

export function CatalogWorkImage({
  src,
  alt,
  variant = "landscape",
  priority = false,
  loading = "lazy",
  sizes,
  frameClassName = "",
  onLoadError,
}: CatalogWorkImageProps) {
  const [failed, setFailed] = useState(false);
  const config = VARIANTS[variant];

  // 画像ステータス判定は追加・更新時のみ。閲覧時は渡された src を表示するだけ。
  if (!src?.trim() || failed) {
    return (
      <div
        className={`relative w-full max-w-full overflow-hidden bg-zinc-100 ${config.frameClass} ${frameClassName}`}
        aria-hidden
        data-image-status="failed"
      />
    );
  }

  return (
    <div
      className={`relative w-full max-w-full overflow-hidden bg-surface ${config.frameClass} ${frameClassName}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className={`catalog-work-image ${imageCoverClassName}`}
        style={imageCoverStyle}
        sizes={sizes ?? config.defaultSizes}
        loading={priority ? undefined : loading}
        priority={priority}
        unoptimized
        onError={() => {
          setFailed(true);
          onLoadError?.();
        }}
      />
    </div>
  );
}
