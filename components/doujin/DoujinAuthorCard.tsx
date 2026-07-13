"use client";

import Image from "next/image";
import Link from "next/link";
import type { DoujinAuthorListItem } from "@/lib/doujin/author-list";
import { DOUJIN_PLACEHOLDER_IMAGE } from "@/lib/doujin/format";

type DoujinAuthorCardProps = {
  author: DoujinAuthorListItem;
};

export function DoujinAuthorCard({ author }: DoujinAuthorCardProps) {
  const href = `/doujin/authors/${author.id}`;
  const imageUrl =
    author.representativeWork?.imageUrl || DOUJIN_PLACEHOLDER_IMAGE;
  const workTitle = author.representativeWork?.title;

  return (
    <article className="doujin-author-card group flex h-full flex-col overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-accent/20 hover:shadow-lg">
      <Link href={href} className="flex h-full flex-col" prefetch>
        <div className="doujin-author-card__image-wrapper">
          <Image
            src={imageUrl}
            alt={`${author.name}の代表作品`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="doujin-author-card__image"
            unoptimized
          />
        </div>

        <div className="flex flex-1 flex-col px-3 py-3">
          <h2 className="line-clamp-2 min-h-[2.5em] text-sm font-semibold leading-snug text-foreground group-hover:text-accent">
            {author.name}
          </h2>
          <p className="mt-1 text-xs text-muted">作品数 {author.workCount}作品</p>
          {workTitle ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted">
              {workTitle}
            </p>
          ) : null}
          <span className="mt-auto pt-3 text-xs font-medium text-accent">
            作者詳細を見る →
          </span>
        </div>
      </Link>
    </article>
  );
}
