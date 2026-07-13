"use client";

import {
  DoujinEntityLinks,
  type DoujinEntityLinkVariant,
} from "@/components/doujin/DoujinEntityLink";

type DoujinAuthorLinksProps = {
  authorIds?: string[];
  authorNames?: string[];
  className?: string;
  stopPropagation?: boolean;
  variant?: DoujinEntityLinkVariant;
  separator?: string;
};

/**
 * 作者名を個別リンク表示。
 * id と name のインデックス対応があるものだけリンク化。
 */
export function DoujinAuthorLinks({
  authorIds,
  authorNames,
  className = "",
  stopPropagation = false,
  variant = "inherit",
  separator = " / ",
}: DoujinAuthorLinksProps) {
  const names = (authorNames ?? []).map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) return null;

  const ids = authorIds ?? [];

  return (
    <DoujinEntityLinks
      items={names.map((name, index) => ({
        name,
        id: ids[index],
      }))}
      hrefFor={(id) => `/doujin/authors/${id}`}
      className={className}
      variant={variant}
      stopPropagation={stopPropagation}
      separator={separator}
    />
  );
}
