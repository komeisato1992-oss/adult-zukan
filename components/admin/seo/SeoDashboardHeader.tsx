"use client";

import { formatSeoDateTime } from "@/components/admin/seo/format";
import type { SeoConnectionStatus } from "@/lib/admin/seo-types";

type SeoDashboardHeaderProps = {
  connectionStatus: SeoConnectionStatus;
  updatedAt: string | null;
  stale?: boolean;
  refreshing: boolean;
  onRefresh: () => void;
};

function ConnectionBadge({ status }: { status: SeoConnectionStatus }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-foreground">
        <span className="inline-block h-2 w-2 rounded-full bg-green-600" />
        接続済み
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-accent">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        APIエラー
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="inline-block h-2 w-2 rounded-full bg-muted" />
      未接続
    </span>
  );
}

export function SeoDashboardHeader({
  connectionStatus,
  updatedAt,
  stale,
  refreshing,
  onRefresh,
}: SeoDashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          SEO管理
        </h1>
        <p className="mt-2 pl-4 text-sm text-muted">
          Google検索からの流入状況と改善候補を確認できます。
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 sm:items-end">
        <ConnectionBadge status={connectionStatus} />
        <p className="text-sm text-muted">
          最終更新：{formatSeoDateTime(updatedAt)}
          {stale ? "（キャッシュ）" : ""}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex h-11 min-h-[44px] w-full items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
        >
          {refreshing ? "更新中…" : "更新"}
        </button>
      </div>
    </div>
  );
}
