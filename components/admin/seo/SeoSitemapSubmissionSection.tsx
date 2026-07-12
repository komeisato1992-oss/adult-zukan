"use client";

import { Fragment, useState } from "react";
import {
  formatSeoDateTime,
  formatSeoNumber,
  formatSeoPercent,
} from "@/components/admin/seo/format";
import { SeoSectionHeading } from "@/components/admin/seo/SeoSectionHeading";
import type {
  SeoEntitySitemapStatus,
  SeoSitemapStatusSnapshot,
  SeoSitemapSubmissionStatus,
} from "@/lib/admin/seo-types";

type SeoSitemapSubmissionSectionProps = {
  snapshot: SeoSitemapStatusSnapshot;
  gscRefreshing?: boolean;
  refreshingKey?: string | null;
  submittingKey?: string | null;
  bulkRefreshing?: boolean;
  bulkSubmitting?: boolean;
  actionMessage?: string | null;
  onRefreshGsc: () => Promise<void>;
  onRefreshAll: () => Promise<void>;
  onSubmitAll: () => Promise<void>;
  onRefreshKey: (key: string) => Promise<void>;
  onSubmitKey: (key: string) => Promise<void>;
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

function formatAt(value: string | null): string {
  if (!value) return "—";
  return formatSeoDateTime(value);
}

function SitemapDetailPanel({ row }: { row: SeoEntitySitemapStatus }) {
  return (
    <dl className="mt-3 grid gap-2 rounded-lg bg-surface p-3 text-xs sm:grid-cols-2">
      <div>
        <dt className="text-muted">最終生成日時</dt>
        <dd className="font-medium text-foreground">
          {formatAt(row.lastGeneratedAt)}
        </dd>
      </div>
      <div>
        <dt className="text-muted">Google最終取得日時</dt>
        <dd className="font-medium text-foreground">
          {formatAt(row.lastDownloaded)}
        </dd>
      </div>
      <div>
        <dt className="text-muted">サイト内URL数</dt>
        <dd className="font-medium text-foreground">
          {row.siteUrlCount !== null ? formatSeoNumber(row.siteUrlCount) : "—"}
        </dd>
      </div>
      <div>
        <dt className="text-muted">Google確認済みURL数</dt>
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
        <dt className="text-muted">Google最終送信日時</dt>
        <dd className="font-medium text-foreground">
          {formatAt(row.lastSubmitted ?? row.googleSubmittedAt)}
        </dd>
      </div>
      <div>
        <dt className="text-muted">HTTPステータス</dt>
        <dd className="font-medium text-foreground">
          {row.httpStatus !== null ? row.httpStatus : "—"}
        </dd>
      </div>
      <div>
        <dt className="text-muted">Warning / Error</dt>
        <dd className="font-medium text-foreground">
          {row.warnings} / {row.errors}
        </dd>
      </div>
    </dl>
  );
}

function RowActions({
  row,
  refreshingKey,
  submittingKey,
  onRefreshKey,
  onSubmitKey,
}: {
  row: SeoEntitySitemapStatus;
  refreshingKey?: string | null;
  submittingKey?: string | null;
  onRefreshKey: (key: string) => Promise<void>;
  onSubmitKey: (key: string) => Promise<void>;
}) {
  const refreshing = refreshingKey === row.id;
  const submitting = submittingKey === row.id;

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={row.submitUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs text-foreground"
      >
        最新内容を確認
      </a>
      <button
        type="button"
        onClick={() => onRefreshKey(row.id)}
        disabled={refreshing || submitting}
        className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs disabled:opacity-60"
      >
        {refreshing ? "更新中…" : "サイトマップを更新"}
      </button>
      <button
        type="button"
        onClick={() => onSubmitKey(row.id)}
        disabled={refreshing || submitting}
        className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-xs font-medium text-white disabled:opacity-60"
      >
        {submitting ? "送信中…" : "Googleへ再送信"}
      </button>
    </div>
  );
}

function CoverageRow({ row }: { row: SeoEntitySitemapStatus }) {
  const siteCount =
    row.siteUrlCount !== null ? formatSeoNumber(row.siteUrlCount) : "—";
  const googleCount =
    row.indexedCount !== null ? formatSeoNumber(row.indexedCount) : "—";
  const rate =
    row.coverageRate !== null ? formatSeoPercent(row.coverageRate) : "—";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-medium text-foreground">{row.label}</p>
      <p className="text-sm text-muted">
        {googleCount} / {siteCount}
        <span className="ml-2 font-medium text-foreground">{rate}</span>
      </p>
    </div>
  );
}

export function SeoSitemapSubmissionSection({
  snapshot,
  gscRefreshing = false,
  refreshingKey = null,
  submittingKey = null,
  bulkRefreshing = false,
  bulkSubmitting = false,
  actionMessage = null,
  onRefreshGsc,
  onRefreshAll,
  onSubmitAll,
  onRefreshKey,
  onSubmitKey,
}: SeoSitemapSubmissionSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          onClick={onRefreshGsc}
          disabled={gscRefreshing}
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {gscRefreshing ? "再取得中…" : "再取得してください"}
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SeoSectionHeading
          title="サイトマップ送信状況"
          description="Search Console sitemaps.list / サイト側生成状況"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefreshAll}
            disabled={bulkRefreshing || bulkSubmitting}
            className="inline-flex h-10 min-h-[44px] items-center rounded-lg border border-border px-4 text-sm disabled:opacity-60"
          >
            {bulkRefreshing ? "更新中…" : "すべて更新"}
          </button>
          <button
            type="button"
            onClick={onSubmitAll}
            disabled={bulkRefreshing || bulkSubmitting}
            className="inline-flex h-10 min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {bulkSubmitting ? "送信中…" : "Googleへすべて再送信"}
          </button>
          <button
            type="button"
            onClick={onRefreshGsc}
            disabled={gscRefreshing}
            className="inline-flex h-10 min-h-[44px] items-center rounded-lg border border-border px-4 text-sm disabled:opacity-60"
          >
            {gscRefreshing ? "再取得中…" : "GSC再取得"}
          </button>
        </div>
      </div>

      {actionMessage ? (
        <p className="whitespace-pre-line rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {actionMessage}
        </p>
      ) : null}

      {snapshot.fetchError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {snapshot.fetchError}
        </p>
      ) : null}

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">名称</th>
              <th className="px-3 py-3 font-medium">状態</th>
              <th className="px-3 py-3 font-medium">サイト内URL数</th>
              <th className="px-3 py-3 font-medium">Google確認済</th>
              <th className="px-3 py-3 font-medium">最終生成</th>
              <th className="px-3 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {snapshot.rows.map((row) => {
              const expanded = expandedId === row.id;
              return (
                <Fragment key={row.id}>
                  <tr className="align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground">{row.displayName}</p>
                      <p className="mt-1 break-all text-xs text-muted">{row.submitUrl}</p>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">
                      {row.siteUrlCount !== null
                        ? formatSeoNumber(row.siteUrlCount)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">
                      {row.indexedCount !== null
                        ? formatSeoNumber(row.indexedCount)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">
                      {formatAt(row.lastGeneratedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : row.id)}
                        className="text-xs text-accent underline"
                      >
                        {expanded ? "閉じる" : "詳細"}
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td colSpan={6} className="px-3 pb-4">
                        <SitemapDetailPanel row={row} />
                        <div className="mt-3">
                          <RowActions
                            row={row}
                            refreshingKey={refreshingKey}
                            submittingKey={submittingKey}
                            onRefreshKey={onRefreshKey}
                            onSubmitKey={onSubmitKey}
                          />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {snapshot.rows.map((row) => {
          const expanded = expandedId === row.id;
          return (
            <div
              key={row.id}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{row.displayName}</p>
                  <p className="mt-1 break-all text-xs text-muted">{row.submitUrl}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                <div>
                  <dt>サイト内URL数</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {row.siteUrlCount !== null
                      ? formatSeoNumber(row.siteUrlCount)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Google確認済</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {row.indexedCount !== null
                      ? formatSeoNumber(row.indexedCount)
                      : "—"}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : row.id)}
                className="mt-2 text-xs text-accent underline"
              >
                {expanded ? "詳細を閉じる" : "詳細を見る"}
              </button>
              {expanded ? (
                <>
                  <SitemapDetailPanel row={row} />
                  <div className="mt-3">
                    <RowActions
                      row={row}
                      refreshingKey={refreshingKey}
                      submittingKey={submittingKey}
                      onRefreshKey={onRefreshKey}
                      onSubmitKey={onSubmitKey}
                    />
                  </div>
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
          Search Console送信済み {snapshot.gscSubmittedCount ?? 0}件 /
          サイト側管理行 {snapshot.rows.length}件
          {snapshot.fetchedAt
            ? ` / GSC最終取得 ${formatSeoDateTime(snapshot.fetchedAt)}`
            : ""}
          {snapshot.fetchError ? ` / 取得エラー: ${snapshot.fetchError}` : ""}
        </p>
        <p className="text-xs text-muted">
          Googleへの再送信は、クロールや登録を保証するものではありません。
        </p>
      </div>
    </section>
  );
}
