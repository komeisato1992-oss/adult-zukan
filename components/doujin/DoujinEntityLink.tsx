"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type DoujinEntityLinkVariant = "link" | "inherit";

const VARIANT_CLASS: Record<DoujinEntityLinkVariant, string> = {
  link: "text-[#2563EB] hover:text-[#1D4ED8] hover:underline",
  inherit:
    "text-inherit hover:text-[#F78FA7] hover:underline",
};

type DoujinEntityLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: DoujinEntityLinkVariant;
  stopPropagation?: boolean;
  prefetch?: boolean;
};

/** 作者・サークル・シリーズ・ジャンル共通のエンティティリンク */
export function DoujinEntityLink({
  href,
  children,
  className = "",
  variant = "link",
  stopPropagation = false,
  prefetch = true,
}: DoujinEntityLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={`rounded-sm underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 ${VARIANT_CLASS[variant]} ${className}`.trim()}
      onClick={
        stopPropagation
          ? (event) => {
              event.stopPropagation();
            }
          : undefined
      }
    >
      {children}
    </Link>
  );
}

export type DoujinEntityRefItem = {
  id?: string | null;
  name: string;
};

type DoujinEntityLinksProps = {
  items: DoujinEntityRefItem[];
  hrefFor: (id: string) => string;
  className?: string;
  variant?: DoujinEntityLinkVariant;
  stopPropagation?: boolean;
  /** 区切り文字（リンクに含めない） */
  separator?: string;
  emptyFallback?: ReactNode;
};

/**
 * 複数エンティティを区切り付きで個別リンク表示。
 * id がない名前はテキストのみ。
 */
export function DoujinEntityLinks({
  items,
  hrefFor,
  className = "",
  variant = "link",
  stopPropagation = false,
  separator = "、",
  emptyFallback = null,
}: DoujinEntityLinksProps) {
  const entries = items
    .map((item) => ({
      id: item.id?.trim() || undefined,
      name: item.name.trim(),
    }))
    .filter((item) => item.name);

  if (entries.length === 0) return <>{emptyFallback}</>;

  return (
    <span className={className}>
      {entries.map((entry, index) => {
        const sep =
          index > 0 ? (
            <span key={`sep-${index}`} aria-hidden>
              {separator}
            </span>
          ) : null;

        if (entry.id) {
          return (
            <span key={`${entry.id}-${entry.name}`}>
              {sep}
              <DoujinEntityLink
                href={hrefFor(entry.id)}
                variant={variant}
                stopPropagation={stopPropagation}
              >
                {entry.name}
              </DoujinEntityLink>
            </span>
          );
        }

        return (
          <span key={`${entry.name}-${index}`}>
            {sep}
            {entry.name}
          </span>
        );
      })}
    </span>
  );
}
