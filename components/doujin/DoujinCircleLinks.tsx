"use client";

import {
  DoujinEntityLinks,
  type DoujinEntityLinkVariant,
} from "@/components/doujin/DoujinEntityLink";

type DoujinCircleLinksProps = {
  circleIds?: Array<string | undefined | null>;
  circleNames?: Array<string | undefined | null>;
  circleId?: string | null;
  circleName?: string | null;
  className?: string;
  stopPropagation?: boolean;
  variant?: DoujinEntityLinkVariant;
  separator?: string;
};

/**
 * サークル名を個別リンク表示。
 * id があるものだけ /doujin/circles/[id] へ。無い名前はテキストのみ。
 */
export function DoujinCircleLinks({
  circleIds,
  circleNames,
  circleId,
  circleName,
  className = "",
  stopPropagation = false,
  variant = "inherit",
  separator = " / ",
}: DoujinCircleLinksProps) {
  const names = (
    circleNames?.length
      ? circleNames
      : circleName
        ? [circleName]
        : []
  )
    .map((name) => name?.trim() ?? "")
    .filter(Boolean);

  if (names.length === 0) return null;

  const ids = (
    circleIds?.length ? circleIds : circleId ? [circleId] : []
  ).map((id) => id?.trim() ?? "");

  return (
    <DoujinEntityLinks
      items={names.map((name, index) => ({
        name,
        id: ids[index],
      }))}
      hrefFor={(id) => `/doujin/circles/${id}`}
      className={className}
      variant={variant}
      stopPropagation={stopPropagation}
      separator={separator}
    />
  );
}
