"use client";

import {
  formatBulkAddLimitOptionLabel,
  type BulkAddLimitChoice,
  resolveBulkAddLimit,
} from "@/lib/admin/bulk-add-limit";
import {
  IMPORT_BULK_ADD_ABSOLUTE_MAX,
  IMPORT_BULK_ADD_OPTIONS,
} from "@/lib/admin/import-constants";
import type { ImportFilterKey } from "@/lib/admin/import-quality";

type ImportBulkToolbarProps = {
  selectedCount: number;
  filteredTotalCount: number;
  visibleCount: number;
  addLimit: BulkAddLimitChoice;
  isBulkAdding: boolean;
  compact?: boolean;
  onAddLimitChange: (limit: BulkAddLimitChoice) => void;
  onSelectPage: () => void;
  onSelectAllMatching: () => void;
  onClearSelection: () => void;
  onSelectByFlag: (flag: ImportFilterKey) => void;
  onBulkAdd: () => void;
};

const QUICK_SELECT_OPTIONS: ImportFilterKey[] = [
  "hasImage",
  "hasActress",
  "hasPrice",
];

const LIMIT_OPTIONS: BulkAddLimitChoice[] = [
  ...IMPORT_BULK_ADD_OPTIONS,
  "all",
];

export function ImportBulkToolbar({
  selectedCount,
  filteredTotalCount,
  visibleCount,
  addLimit,
  isBulkAdding,
  compact = false,
  onAddLimitChange,
  onSelectPage,
  onSelectAllMatching,
  onClearSelection,
  onSelectByFlag,
  onBulkAdd,
}: ImportBulkToolbarProps) {
  const addCount = resolveBulkAddLimit(addLimit, selectedCount);
  const bulkAddDisabled = selectedCount === 0 || addCount === 0 || isBulkAdding;

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 text-sm font-semibold text-foreground">
          選択中 {selectedCount.toLocaleString()}件
        </p>
        <button
          type="button"
          onClick={onBulkAdd}
          disabled={bulkAddDisabled}
          title={selectedCount === 0 ? "作品を選択してください" : undefined}
          className="inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBulkAdding ? "追加中..." : "一括追加"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground">一括追加</p>
          <p className="text-xs text-muted">
            候補総数：{filteredTotalCount.toLocaleString()}件 / 表示中：
            {visibleCount.toLocaleString()}件 / 選択中：
            {selectedCount.toLocaleString()}件
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <span className="text-muted">追加上限：</span>
              <select
                value={addLimit}
                onChange={(event) =>
                  onAddLimitChange(event.target.value as BulkAddLimitChoice)
                }
                className="h-10 min-w-[160px] rounded-lg border border-border bg-white px-3 text-sm text-foreground"
              >
                {LIMIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatBulkAddLimitOptionLabel(option, selectedCount)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted">
              {addCount > 0
                ? `一括追加対象 ${addCount.toLocaleString()}件（1回最大${IMPORT_BULK_ADD_ABSOLUTE_MAX}件）`
                : `1回最大${IMPORT_BULK_ADD_ABSOLUTE_MAX}件`}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-1 sm:w-auto">
          <button
            type="button"
            onClick={onBulkAdd}
            disabled={bulkAddDisabled}
            title={selectedCount === 0 ? "作品を選択してください" : undefined}
            className="inline-flex h-11 min-h-[44px] w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isBulkAdding ? "追加中..." : "選択した作品を一括追加"}
          </button>
          {selectedCount === 0 ? (
            <p className="text-center text-xs text-muted sm:text-right">
              作品を選択してください
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelectPage}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-accent hover:text-accent"
        >
          このページの{visibleCount.toLocaleString()}件を選択
        </button>
        <button
          type="button"
          onClick={onSelectAllMatching}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-accent hover:text-accent"
        >
          全{filteredTotalCount.toLocaleString()}件を選択
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
