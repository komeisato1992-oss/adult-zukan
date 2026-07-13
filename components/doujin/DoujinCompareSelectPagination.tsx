"use client";

import Link from "next/link";
import { buildPaginationHref } from "@/lib/pagination";
import {
  DOUJIN_COMPARE_GA_EVENTS,
  trackDoujinCompareEvent,
} from "@/lib/doujin/compare/analytics";
import type { DoujinSimilaritySort } from "@/lib/doujin/compare/similarity";

type DoujinCompareSelectPaginationProps = {
  workId: string;
  currentPage: number;
  totalPages: number;
  sort: DoujinSimilaritySort;
};

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const pages = new Set<number>([1, totalPages, currentPage]);
  for (let offset = -1; offset <= 1; offset++) {
    const page = currentPage + offset;
    if (page >= 1 && page <= totalPages) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}

export function DoujinCompareSelectPagination({
  workId,
  currentPage,
  totalPages,
  sort,
}: DoujinCompareSelectPaginationProps) {
  if (totalPages <= 1) return null;

  const basePath = `/doujin/compare/select/${workId}`;
  const query = {
    sort: sort === "overall" ? undefined : sort,
  };
  const pages = getVisiblePages(currentPage, totalPages);
  const pageClassName = (page: number) =>
    `flex h-9 min-w-9 items-center justify-center rounded border px-3 text-sm transition-colors ${
      page === currentPage
        ? "border-accent bg-accent text-white"
        : "border-border text-foreground hover:border-accent hover:text-accent"
    }`;
  const navButtonClassName =
    "rounded border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-accent hover:text-accent";

  function trackPage(page: number) {
    trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.pageChange, {
      content_id: workId,
      page,
      sort,
    });
  }

  return (
    <nav
      aria-label="ページネーション"
      className="mt-8 flex max-w-full flex-wrap items-center justify-center gap-2"
    >
      {currentPage > 1 ? (
        <Link
          href={buildPaginationHref(basePath, currentPage - 1, query)}
          onClick={() => trackPage(currentPage - 1)}
          className={navButtonClassName}
        >
          前へ
        </Link>
      ) : null}

      {pages.map((page, index) => {
        const prev = pages[index - 1];
        const showEllipsis = prev !== undefined && page - prev > 1;

        return (
          <span key={page} className="flex items-center gap-2">
            {showEllipsis ? (
              <span className="px-1 text-sm text-muted">…</span>
            ) : null}
            <Link
              href={buildPaginationHref(basePath, page, query)}
              onClick={() => trackPage(page)}
              aria-current={page === currentPage ? "page" : undefined}
              className={pageClassName(page)}
            >
              {page}
            </Link>
          </span>
        );
      })}

      {currentPage < totalPages ? (
        <Link
          href={buildPaginationHref(basePath, currentPage + 1, query)}
          onClick={() => trackPage(currentPage + 1)}
          className={navButtonClassName}
        >
          次へ
        </Link>
      ) : null}
    </nav>
  );
}
