"use client";

import {
  IMPORT_CANDIDATE_SORT_LABELS,
  type ImportCandidateSortKey,
} from "@/lib/admin/import-candidate-types";

type ImportSortBarProps = {
  sort: ImportCandidateSortKey;
  page: number;
  totalPages: number;
  totalCount: number;
  onSortChange: (sort: ImportCandidateSortKey) => void;
  onPageChange: (page: number) => void;
};

export function ImportSortBar({
  sort,
  page,
  totalPages,
  totalCount,
  onSortChange,
  onPageChange,
}: ImportSortBarProps) {
  const sortKeys = Object.keys(
    IMPORT_CANDIDATE_SORT_LABELS,
  ) as ImportCandidateSortKey[];

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">並び替え</p>
          <p className="mt-1 text-xs text-muted">
            {totalCount.toLocaleString()} 件中 {page} / {totalPages} ページ（1ページ100件）
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            前へ
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            次へ
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {sortKeys.map((key) => {
          const active = sort === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSortChange(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-accent text-white"
                  : "border border-border bg-white text-foreground hover:border-accent hover:text-accent"
              }`}
            >
              {IMPORT_CANDIDATE_SORT_LABELS[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
