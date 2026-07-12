"use client";

import { useState } from "react";
import { SeoDataTable } from "@/components/admin/seo/SeoDataTable";
import { formatSeoDateTime, formatSeoNumber } from "@/components/admin/seo/format";
import {
  classifyGscSitemapRow,
  gscSitemapHealthLabel,
} from "@/lib/admin/seo-sitemap-gsc-summary";
import type { SeoSitemapRow } from "@/lib/admin/seo-types";

type SeoSitemapsTabProps = {
  sitemaps: SeoSitemapRow[];
  onSubmit: () => Promise<void>;
  submitting: boolean;
};

export function SeoSitemapsTab({
  sitemaps,
  onSubmit,
  submitting,
}: SeoSitemapsTabProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setMessage(null);
    setError(null);
    try {
      await onSubmit();
      setMessage("サイトマップを送信しました。");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "サイトマップ送信に失敗しました。",
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Search Console API（sitemaps.list）の取得結果をそのまま表示します。
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? "送信中..." : "サイトマップ送信"}
        </button>
      </div>

      {message ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <SeoDataTable
        rows={sitemaps}
        pageSize={10}
        emptyMessage="サイトマップ情報は更新後に表示されます。"
        columns={[
          {
            key: "path",
            label: "サイトマップURL",
            sortable: true,
            sortValue: (row) => row.path,
            render: (row) => (
              <span className="break-all [overflow-wrap:anywhere]">{row.path}</span>
            ),
          },
          {
            key: "typeLabel",
            label: "種別",
            sortable: true,
            sortValue: (row) => row.typeLabel ?? "",
            className: "whitespace-nowrap",
            render: (row) => row.typeLabel ?? "—",
          },
          {
            key: "lastSubmitted",
            label: "送信日時",
            sortable: true,
            sortValue: (row) => row.lastSubmitted ?? "",
            className: "whitespace-nowrap",
            render: (row) => formatSeoDateTime(row.lastSubmitted ?? null),
          },
          {
            key: "lastDownloaded",
            label: "最終ダウンロード",
            sortable: true,
            sortValue: (row) => row.lastDownloaded ?? "",
            className: "whitespace-nowrap",
            render: (row) => formatSeoDateTime(row.lastDownloaded ?? null),
          },
          {
            key: "status",
            label: "状態",
            sortable: true,
            sortValue: (row) => classifyGscSitemapRow(row),
            className: "whitespace-nowrap",
            render: (row) => gscSitemapHealthLabel(classifyGscSitemapRow(row)),
          },
          {
            key: "warnings",
            label: "警告数",
            sortable: true,
            sortValue: (row) => row.warnings,
            className: "whitespace-nowrap",
            render: (row) => formatSeoNumber(row.warnings),
          },
          {
            key: "errors",
            label: "エラー数",
            sortable: true,
            sortValue: (row) => row.errors,
            className: "whitespace-nowrap",
            render: (row) => formatSeoNumber(row.errors),
          },
          {
            key: "contentsCount",
            label: "検出URL数",
            sortable: true,
            sortValue: (row) => row.contentsCount,
            className: "whitespace-nowrap",
            render: (row) => formatSeoNumber(row.contentsCount),
          },
          {
            key: "videoSubmitted",
            label: "検出動画数",
            sortable: true,
            sortValue: (row) => row.videoSubmitted ?? 0,
            className: "whitespace-nowrap",
            render: (row) => formatSeoNumber(row.videoSubmitted ?? 0),
          },
          {
            key: "indexedCount",
            label: "取得結果(indexed)",
            sortable: true,
            sortValue: (row) => row.indexedCount,
            className: "whitespace-nowrap",
            render: (row) => formatSeoNumber(row.indexedCount),
          },
        ]}
      />
    </div>
  );
}
