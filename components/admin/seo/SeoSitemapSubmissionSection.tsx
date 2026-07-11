"use client";

import { Fragment, useState } from "react";
import {
  formatSeoDateTime,
  formatSeoNumber,
  formatSeoPercent,
} from "@/components/admin/seo/format";
import { SeoSectionHeading } from "@/components/admin/seo/SeoSectionHeading";
import { countSubmittedSitemaps } from "@/lib/admin/seo-sitemap-status";
import type {
  SeoEntitySitemapStatus,
  SeoSitemapStatusSnapshot,
  SeoSitemapSubmissionStatus,
} from "@/lib/admin/seo-types";

type SeoSitemapSubmissionSectionProps = {
  snapshot: SeoSitemapStatusSnapshot;
  refreshing?: boolean;
  onRefresh: () => Promise<void>;
  /** 将来 sitemaps.submit 用 */
  onSubmit?: (row: SeoEntitySitemapStatus) => Promise<void>;
};

const STATUS_META: Record<
  SeoSitemapSubmissionStatus,
  { label: string; className: string }
> = {
  success: { label: "成功", className: "text-green-600" },
  pending: { label: "未送信", className: "text-amber-600" },
  fetch_error: { label: "取得失敗", className: "text-accent" },
};

function StatusBadge({ status }: { status: SeoSitemapSubmissionStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${meta.className}`}>
      {status === "success" ? "✅" : null}
      {meta.label}
    </span>
  );
}

function formatSubmittedAt(value: string | null): string {
  if (!value) return "—";
  return formatSeoDateTime(value);
}

function SitemapDetailPanel({ row }: { row: SeoEntitySitemapStatus }) {
  return (
    <dl className="mt-3 grid gap-2 rounded-lg bg-surface p-3 text-xs sm:grid-cols-2">
      <div>
        <dt className="text-muted">最終取得日時</dt>
        <dd className="font-medium text-foreground">
          {formatSubmittedAt(row.lastDownloaded)}
        </dd>
      </div>
      <div>
        <dt className="text-muted">登録URL数</dt>
        <dd className="font-medium text-foreground">
          {row.indexedCount !== null ? formatSeoNumber(row.indexedCount) : "—"}
        </dd>
      </div>
      <div>
        <dt className="text-muted">未登録URL数</dt>
        <dd className="font-medium text-foreground">
          {row.notIndexedCount !== null
            ? formatSeoNumber(row.notIndexedCount)
            : "—"}
        </dd>
      </div>
      <div>
        <dt className="text-muted">送信URL</dt>
        <dd className="break-all font-medium text-foreground">{row.submitUrl}</dd>
      </div>
      <div>
        <dt className="text-muted">HTTPステータス</dt>
        <dd className="font-medium text-foreground">
          {row.httpStatus !== null ? row.httpStatus : "—"}
        </dd>
      </div>
      <div>
        <dt className="text-muted">検出URL数</dt>
        <dd className="font-medium text-foreground">
          {row.contentsCount !== null ? formatSeoNumber(row.contentsCount) : "—"}
        </dd>
      </div>
    </dl>
  );
}

function CoverageRow({ row }: { row: SeoEntitySitemapStatus }) {
  const registered =
    row.indexedCount !== null ? formatSeoNumber(row.indexedCount) : "—";
  const local = formatSeoNumber(row.localCount);
  const rate =
    row.coverageRate !== null ? formatSeoPercent(row.coverageRate) : "—";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-medium text-foreground">{row.label}</p>
      <p className="text-sm text-muted">
        {registered} / {local}
        <span className="ml-2 font-medium text-foreground">{rate}</span>
      </p>
    </div>
  );
}

export function SeoSitemapSubmissionSection({
  snapshot,
  refreshing = false,
  onRefresh,
  onSubmit,
}: SeoSitemapSubmissionSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  if (snapshot.fetchError && snapshot.rows.every((row) => row.status === "fetch_error")) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="border-l-4 border-accent pl-3 text-lg font-bold text-red-800">
          サイトマップ送信状況
        </h2>
        <p className="mt-3 text-sm text-red-800">
          Search Consoleからサイトマップ情報を取得できません。
        </p>
        <p className="mt-1 text-sm font-medium text-red-800">APIエラー</p>
        <p className="mt-2 text-xs text-red-700">{snapshot.fetchError}</p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {refreshing ? "再取得中…" : "再取得してください"}
        </button>
      </section>
    );
  }

  async function handleSubmit(row: SeoEntitySitemapStatus) {
    if (!onSubmit) return;
    setSubmittingId(row.id);
    try {
      await onSubmit(row);
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SeoSectionHeading
          title="サイトマップ送信状況"
          description="Search Console sitemaps.list"
        />
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex h-10 min-h-[44px] items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground disabled:opacity-60"
        >
          {refreshing ? "再取得中…" : "再取得"}
        </button>
      </div>

      {snapshot.fetchError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {snapshot.fetchError}
        </p>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Sitemap</th>
              <th className="px-3 py-3 font-medium">状態</th>
              <th className="px-3 py-3 font-medium">登録URL数</th>
              <th className="px-3 py-3 font-medium">最終送信</th>
              <th className="px-3 py-3 font-medium">更新</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {snapshot.rows.map((row) => {
              const expanded = expandedId === row.id;
              return (
                <Fragment key={row.id}>
                  <tr className="align-top">
                    <td className="px-3 py-3 font-medium text-foreground">
                      {row.displayName}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">
                      {row.indexedCount !== null
                        ? formatSeoNumber(row.indexedCount)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">
                      {formatSubmittedAt(row.lastSubmitted)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : row.id)
                        }
                        className="text-xs text-accent underline"
                      >
                        {expanded ? "閉じる" : "更新"}
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td colSpan={5} className="px-3 pb-4">
                        <SitemapDetailPanel row={row} />
                        {onSubmit ? (
                          <button
                            type="button"
                            onClick={() => handleSubmit(row)}
                            disabled={submittingId === row.id}
                            className="mt-3 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-60"
                          >
                            {submittingId === row.id ? "送信中…" : "送信"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {snapshot.rows.map((row) => {
          const expanded = expandedId === row.id;
          return (
            <div
              key={row.id}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : row.id)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{row.displayName}</p>
                  <StatusBadge status={row.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                  <div>
                    <dt>登録URL数</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {row.indexedCount !== null
                        ? formatSeoNumber(row.indexedCount)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>最終送信</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {formatSubmittedAt(row.lastSubmitted)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-accent underline">
                  {expanded ? "詳細を閉じる" : "詳細を見る"}
                </p>
              </button>
              {expanded ? (
                <>
                  <SitemapDetailPanel row={row} />
                  {onSubmit ? (
                    <button
                      type="button"
                      onClick={() => handleSubmit(row)}
                      disabled={submittingId === row.id}
                      className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-white disabled:opacity-60"
                    >
                      {submittingId === row.id ? "送信中…" : "送信"}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-bold text-foreground">サイトマップ送信率</h3>
        {snapshot.rows.map((row) => (
          <CoverageRow key={`coverage-${row.id}`} row={row} />
        ))}
        <p className="text-xs text-muted">
          送信済{" "}
          {(() => {
            const { submitted, total } = countSubmittedSitemaps(snapshot);
            return `${submitted}/${total}`;
          })()}
          {snapshot.fetchedAt
            ? ` / 最終取得 ${formatSeoDateTime(snapshot.fetchedAt)}`
            : ""}
        </p>
      </div>
    </section>
  );
}
