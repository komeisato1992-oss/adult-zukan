"use client";

import {
  IMPORT_QUALITY_FILTER_LABELS,
  IMPORT_SEO_FILTER_LABELS,
  type ImportFilterKey,
  type ImportQualityFilterKey,
  type ImportSeoFilterKey,
} from "@/lib/admin/import-quality";

type ImportFilterBarProps = {
  activeFilters: Set<ImportFilterKey>;
  onToggleFilter: (key: ImportFilterKey) => void;
  onClearFilters: () => void;
};

const qualityFilterKeys = Object.keys(
  IMPORT_QUALITY_FILTER_LABELS,
) as ImportQualityFilterKey[];

const seoFilterKeys = Object.keys(
  IMPORT_SEO_FILTER_LABELS,
) as ImportSeoFilterKey[];

export function ImportFilterBar({
  activeFilters,
  onToggleFilter,
  onClearFilters,
}: ImportFilterBarProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-foreground">フィルター</p>
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

      <p className="mt-3 text-xs font-semibold text-muted">品質</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {qualityFilterKeys.map((key) => {
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
              {IMPORT_QUALITY_FILTER_LABELS[key]}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs font-semibold text-muted">SEO優先度</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {seoFilterKeys.map((key) => {
          const active = activeFilters.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggleFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-amber-600 text-white"
                  : "border border-border bg-white text-foreground hover:border-amber-500 hover:text-amber-700"
              }`}
            >
              {IMPORT_SEO_FILTER_LABELS[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
