"use client";

import { useMemo, useState, type ReactNode } from "react";

type Column<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
};

type SeoDataTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  pageSize?: number;
  emptyMessage?: string;
};

export function SeoDataTable<T>({
  rows,
  columns,
  searchPlaceholder = "検索",
  searchFilter,
  pageSize = 20,
  emptyMessage = "データがありません。",
}: SeoDataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || !searchFilter) return rows;
    return rows.filter((row) => searchFilter(row, normalized));
  }, [query, rows, searchFilter]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const column = columns.find((item) => item.key === sortKey);
    if (!column?.sortValue) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aValue = column.sortValue!(a);
      const bValue = column.sortValue!(b);
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }
      return sortDirection === "asc"
        ? String(aValue).localeCompare(String(bValue), "ja")
        : String(bValue).localeCompare(String(aValue), "ja");
    });
  }, [columns, filteredRows, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  }

  return (
    <div className="space-y-4">
      {searchFilter ? (
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder={searchPlaceholder}
          className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-accent dark:border-zinc-700 dark:bg-zinc-900"
        />
      ) : null}

      {pageRows.length === 0 ? (
        <p className="rounded-xl border border-border bg-white px-4 py-6 text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="border-b border-border bg-surface text-xs text-muted dark:bg-zinc-950">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-3 py-3 font-medium sm:px-4 ${column.className ?? ""}`}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {column.label}
                        {sortKey === column.key
                          ? sortDirection === "asc"
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((row, index) => (
                <tr key={index} className="align-top">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-3 text-foreground sm:px-4 ${column.className ?? ""}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sortedRows.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            {sortedRows.length.toLocaleString("ja-JP")}件中{" "}
            {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, sortedRows.length)}件
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-border px-3 py-2 disabled:opacity-50"
            >
              前へ
            </button>
            <span className="text-muted">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="rounded-lg border border-border px-3 py-2 disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
