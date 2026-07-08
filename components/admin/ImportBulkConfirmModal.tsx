"use client";

import type { ImportSelectionSummary } from "@/lib/admin/import-quality";

type ImportBulkConfirmModalProps = {
  summary: ImportSelectionSummary;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ImportBulkConfirmModal({
  summary,
  isSubmitting,
  onConfirm,
  onCancel,
}: ImportBulkConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-confirm-title"
        className="w-full max-w-md rounded-xl border border-border bg-white p-5 shadow-xl"
      >
        <h2 id="bulk-confirm-title" className="text-lg font-bold text-foreground">
          一括追加の確認
        </h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">選択件数</dt>
            <dd className="font-semibold text-foreground">{summary.total}件</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">画像なし</dt>
            <dd className="text-foreground">{summary.noImage}件</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">女優なし</dt>
            <dd className="text-foreground">{summary.noActress}件</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">価格なし</dt>
            <dd className="text-foreground">{summary.noPrice}件</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">説明文なし</dt>
            <dd className="text-foreground">{summary.noDescription}件</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">サンプル画像なし</dt>
            <dd className="text-foreground">{summary.noSampleImages}件</dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-foreground">この内容で追加しますか？</p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {isSubmitting ? "追加中..." : "追加する"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-sm text-foreground hover:border-accent hover:text-accent disabled:opacity-60"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
