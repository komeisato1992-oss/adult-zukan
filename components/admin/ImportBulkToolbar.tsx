"use client";

import { IMPORT_BULK_ADD_MAX } from "@/lib/admin/import-constants";
import type { ImportFilterKey } from "@/lib/admin/import-quality";

type ImportBulkToolbarProps = {
  selectedCount: number;
  filteredCount: number;
  isBulkAdding: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSelectByFlag: (flag: ImportFilterKey) => void;
  onBulkAdd: () => void;
};

const QUICK_SELECT_OPTIONS: ImportFilterKey[] = [
  "hasImage",
  "hasActress",
  "hasPrice",
  "hasSampleImages",
];

export function ImportBulkToolbar({
  selectedCount,
  filteredCount,
  isBulkAdding,
  onSelectAll,
  onClearSelection,
  onSelectByFlag,
  onBulkAdd,
}: ImportBulkToolbarProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">一括追加</p>
          <p className="mt-1 text-xs text-muted">
            選択 {selectedCount} 件 / 表示 {filteredCount} 件（1回最大 {IMPORT_BULK_ADD_MAX} 件）
          </p>
        </div>
        <button
          type="button"
          onClick={onBulkAdd}
          disabled={selectedCount === 0 || isBulkAdding}
          className="inline-flex h-11 min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBulkAdding ? "追加中..." : "選択した作品を追加"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-accent hover:text-accent"
        >
          全選択
        </button>
        <button
          type="button"
          onClick={onClearSelection}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-accent hover:text-accent"
        >
          選択解除
        </button>
        {QUICK_SELECT_OPTIONS.map((flag) => (
          <button
            key={flag}
            type="button"
            onClick={() => onSelectByFlag(flag)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-accent hover:text-accent"
          >
            {flag === "hasImage" && "画像ありだけ選択"}
            {flag === "hasActress" && "女優ありだけ選択"}
            {flag === "hasPrice" && "価格ありだけ選択"}
            {flag === "hasSampleImages" && "サンプル画像ありだけ選択"}
          </button>
        ))}
      </div>
    </div>
  );
}
