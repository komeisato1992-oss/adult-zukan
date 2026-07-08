"use client";

import { IMPORT_BULK_ADD_MAX } from "@/lib/admin/import-constants";
import type { ImportFilterKey } from "@/lib/admin/import-quality";

type ImportBulkToolbarProps = {
  selectedCount: number;
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
];

export function ImportBulkToolbar({
  selectedCount,
  isBulkAdding,
  onSelectAll,
  onClearSelection,
  onSelectByFlag,
  onBulkAdd,
}: ImportBulkToolbarProps) {
  return (
    <div className="sticky top-0 z-20 rounded-xl border border-border bg-white/95 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-foreground">
          選択中：{selectedCount}件
          <span className="ml-2 text-xs font-normal text-muted">
            （1回最大 {IMPORT_BULK_ADD_MAX} 件）
          </span>
        </p>
        <button
          type="button"
          onClick={onBulkAdd}
          disabled={selectedCount === 0 || isBulkAdding}
          className="inline-flex h-11 min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBulkAdding ? "追加中..." : "選択した作品を一括追加"}
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
          </button>
        ))}
      </div>
    </div>
  );
}
