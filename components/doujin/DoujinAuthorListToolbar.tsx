"use client";

import Link from "next/link";
import {
  DOUJIN_AUTHOR_LIMIT_OPTIONS,
  DOUJIN_AUTHOR_SORT_OPTIONS,
  buildDoujinAuthorListUrl,
  type DoujinAuthorLimit,
  type DoujinAuthorListPageData,
  type DoujinAuthorSortKey,
} from "@/lib/doujin/author-list";

type DoujinAuthorListToolbarProps = {
  listData: Pick<DoujinAuthorListPageData, "sort" | "perPage" | "totalItems">;
};

export function DoujinAuthorListToolbar({
  listData,
}: DoujinAuthorListToolbarProps) {
  const { sort, perPage, totalItems } = listData;

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted">
        作者 {totalItems.toLocaleString("ja-JP")}名
      </p>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {DOUJIN_AUTHOR_SORT_OPTIONS.map((option) => (
            <Link
              key={option.key}
              href={buildDoujinAuthorListUrl({
                sort: option.key,
                perPage,
                page: 1,
              })}
              className={`rounded-full border px-3 py-1.5 transition-colors ${
                sort === option.key
                  ? "border-accent bg-accent-light text-accent"
                  : "border-border bg-white text-foreground hover:border-accent hover:text-accent"
              }`}
              scroll
            >
              {option.label}
            </Link>
          ))}
        </div>

        <label className="flex items-center gap-2 text-muted">
          <span className="shrink-0">表示件数</span>
          <select
            className="h-9 rounded border border-border bg-white px-2 text-foreground"
            value={String(perPage)}
            aria-label="表示件数"
            onChange={(event) => {
              const next = Number(event.target.value) as DoujinAuthorLimit;
              window.location.assign(
                buildDoujinAuthorListUrl({
                  sort: sort as DoujinAuthorSortKey,
                  perPage: next,
                  page: 1,
                }),
              );
            }}
          >
            {DOUJIN_AUTHOR_LIMIT_OPTIONS.map((limit) => (
              <option key={limit} value={limit}>
                {limit}件
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
