"use client";

import type { ReactNode } from "react";
import {
  DoujinEntityLinks,
  type DoujinEntityLinkVariant,
} from "@/components/doujin/DoujinEntityLink";

type DoujinGenreLinksProps = {
  genreIds?: Array<string | undefined | null>;
  genreNames?: Array<string | undefined | null>;
  className?: string;
  stopPropagation?: boolean;
  variant?: DoujinEntityLinkVariant;
  separator?: string;
  emptyFallback?: ReactNode;
};

/** ジャンル名を個別リンク表示（区切りはリンクに含めない） */
export function DoujinGenreLinks({
  genreIds,
  genreNames,
  className = "",
  stopPropagation = false,
  variant = "link",
  separator = "、",
  emptyFallback = "-",
}: DoujinGenreLinksProps) {
  const names = (genreNames ?? [])
    .map((name) => name?.trim() ?? "")
    .filter(Boolean);
  if (names.length === 0) return <>{emptyFallback}</>;

  const ids = genreIds ?? [];

  return (
    <DoujinEntityLinks
      items={names.map((name, index) => ({
        name,
        id: ids[index],
      }))}
      hrefFor={(id) => `/doujin/genres/${id}`}
      className={className}
      variant={variant}
      stopPropagation={stopPropagation}
      separator={separator}
      emptyFallback={emptyFallback}
    />
  );
}
