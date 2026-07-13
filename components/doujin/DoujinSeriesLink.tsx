"use client";

import type { ReactNode } from "react";
import {
  DoujinEntityLink,
  type DoujinEntityLinkVariant,
} from "@/components/doujin/DoujinEntityLink";

type DoujinSeriesLinkProps = {
  seriesId?: string | null;
  seriesName?: string | null;
  className?: string;
  stopPropagation?: boolean;
  variant?: DoujinEntityLinkVariant;
  emptyFallback?: ReactNode;
};

export function DoujinSeriesLink({
  seriesId,
  seriesName,
  className = "",
  stopPropagation = false,
  variant = "link",
  emptyFallback = "-",
}: DoujinSeriesLinkProps) {
  const name = seriesName?.trim();
  if (!name) return <>{emptyFallback}</>;
  const id = seriesId?.trim();
  if (!id) return <span className={className}>{name}</span>;

  return (
    <DoujinEntityLink
      href={`/doujin/series/${id}`}
      className={className}
      variant={variant}
      stopPropagation={stopPropagation}
    >
      {name}
    </DoujinEntityLink>
  );
}
