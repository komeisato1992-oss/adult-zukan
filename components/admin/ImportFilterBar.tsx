"use client";

import {
  IMPORT_FILTER_LABELS,
  type ImportFilterKey,
} from "@/lib/admin/import-quality";

type ImportFilterBarProps = {
  activeFilters: Set<ImportFilterKey>;
  onToggleFilter: (key: ImportFilterKey) => void;
  onClearFilters: () => void;
};

export function ImportFilterBar({
  activeFilters,
  onToggleFilter,
  onClearFilters,
}: ImportFilterBarProps) {
  const filterKeys = Object.keys(IMPORT_FILTER_LABELS) as ImportFilterKey[];

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-foreground">品質フィルター</p>
        {activeFilters.size > 0 ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-muted hover:text-accent"
          >
            フィルター解除
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {filterKeys.map((key) => {
          const active = activeFilters.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggleFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-accent text-white"
                  : "border border-border bg-white text-foreground hover:border-accent hover:text-accent"
              }`}
            >
              {IMPORT_FILTER_LABELS[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
