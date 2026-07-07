import Link from "next/link";
import { buildPaginationHref } from "@/lib/pagination";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | undefined>;
  onPageChange?: (page: number) => void;
};

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const pages = new Set<number>([1, totalPages, currentPage]);
  for (let offset = -1; offset <= 1; offset++) {
    const page = currentPage + offset;
    if (page >= 1 && page <= totalPages) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  query = {},
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getVisiblePages(currentPage, totalPages);
  const pageClassName = (page: number) =>
    `flex h-9 min-w-9 items-center justify-center rounded border px-3 text-sm transition-colors ${
      page === currentPage
        ? "border-accent bg-accent text-white"
        : "border-border text-foreground hover:border-accent hover:text-accent"
    }`;
  const navButtonClassName =
    "rounded border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-accent hover:text-accent";

  return (
    <nav
      aria-label="ページネーション"
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      {currentPage > 1 ? (
        onPageChange ? (
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            className={navButtonClassName}
          >
            前へ
          </button>
        ) : (
          <Link
            href={buildPaginationHref(basePath, currentPage - 1, query)}
            className={navButtonClassName}
          >
            前へ
          </Link>
        )
      ) : null}

      {pages.map((page, index) => {
        const prev = pages[index - 1];
        const showEllipsis = prev !== undefined && page - prev > 1;

        return (
          <span key={page} className="flex items-center gap-2">
            {showEllipsis ? (
              <span className="px-1 text-sm text-muted">…</span>
            ) : null}
            {onPageChange ? (
              <button
                type="button"
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? "page" : undefined}
                className={pageClassName(page)}
              >
                {page}
              </button>
            ) : (
              <Link
                href={buildPaginationHref(basePath, page, query)}
                aria-current={page === currentPage ? "page" : undefined}
                className={pageClassName(page)}
              >
                {page}
              </Link>
            )}
          </span>
        );
      })}

      {currentPage < totalPages ? (
        onPageChange ? (
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            className={navButtonClassName}
          >
            次へ
          </button>
        ) : (
          <Link
            href={buildPaginationHref(basePath, currentPage + 1, query)}
            className={navButtonClassName}
          >
            次へ
          </Link>
        )
      ) : null}
    </nav>
  );
}
