"use client";

import Link from "next/link";
import { useAdminMobileNav } from "@/components/admin/AdminMobileNavContext";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import type { OpsRefreshJobKey } from "@/lib/admin/ops-refresh-client";
import { opsTabHref, type OpsTabId } from "@/lib/admin/ops-tabs";

type ActionItem =
  | { id: string; label: string; kind: "button"; onClick: () => void; primary?: boolean }
  | { id: string; label: string; kind: "link"; href: string; onClick?: () => void };

type AdminDashboardHeaderProps = {
  updatedAt: string | null;
  refreshing: boolean;
  refreshingLabel?: string | null;
  onRefreshAll: () => void;
  onNavigateTab: (tab: OpsTabId) => void;
  onRefreshSource?: (key: OpsRefreshJobKey) => void;
};

export function AdminDashboardHeader({
  updatedAt,
  refreshing,
  refreshingLabel,
  onRefreshAll,
  onNavigateTab,
}: AdminDashboardHeaderProps) {
  const mobileNav = useAdminMobileNav();

  const actions: ActionItem[] = [
    {
      id: "refresh-all",
      label: refreshing ? "更新中…" : "全体更新",
      kind: "button",
      onClick: onRefreshAll,
      primary: true,
    },
    {
      id: "top",
      label: "TOP",
      kind: "link",
      href: opsTabHref("overview"),
      onClick: () => onNavigateTab("overview"),
    },
    {
      id: "gsc",
      label: "Search Console",
      kind: "link",
      href: opsTabHref("search-console"),
      onClick: () => onNavigateTab("search-console"),
    },
    {
      id: "ga4",
      label: "GA4",
      kind: "link",
      href: opsTabHref("ga4"),
      onClick: () => onNavigateTab("ga4"),
    },
    {
      id: "dmm",
      label: "DMM",
      kind: "link",
      href: opsTabHref("dmm"),
      onClick: () => onNavigateTab("dmm"),
    },
    {
      id: "settings",
      label: "設定",
      kind: "link",
      href: "/admin/settings",
    },
  ];

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-surface/95 px-4 backdrop-blur md:-mx-6 md:px-6">
      <div className="flex min-h-12 items-center justify-between gap-2 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label="メニューを開く"
            onClick={() => mobileNav?.openMobileNav()}
            className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-white text-sm font-semibold lg:hidden"
          >
            ☰
          </button>
          <h1 className="truncate text-base font-bold text-foreground sm:text-lg">
            運営ダッシュボード
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="hidden text-xs text-muted sm:block">
            {formatSeoDateTime(updatedAt)}
          </p>
          <p className="text-[11px] text-muted sm:hidden">
            {formatSeoDateTime(updatedAt)}
          </p>
          <button
            type="button"
            onClick={onRefreshAll}
            className="inline-flex h-11 min-h-[44px] items-center rounded-lg bg-accent px-3 text-sm font-semibold text-white"
          >
            {refreshing ? "確認" : "更新"}
          </button>
        </div>
      </div>

      {refreshingLabel ? (
        <p className="pb-2 text-xs font-medium text-sky-800">{refreshingLabel}</p>
      ) : null}

      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="flex min-w-max gap-2">
          {actions.map((action) => {
            if (action.kind === "button") {
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.onClick}
                  disabled={refreshing && action.id === "refresh-all"}
                  className={`inline-flex h-11 min-h-[44px] shrink-0 items-center rounded-lg px-3 text-sm font-semibold ${
                    action.primary
                      ? "bg-accent text-white disabled:opacity-60"
                      : "border border-border bg-white text-foreground"
                  }`}
                >
                  {action.label}
                </button>
              );
            }
            return (
              <Link
                key={action.id}
                href={action.href}
                onClick={(event) => {
                  if (!action.onClick) return;
                  event.preventDefault();
                  action.onClick();
                }}
                className="inline-flex h-11 min-h-[44px] shrink-0 items-center rounded-lg border border-border bg-white px-3 text-sm font-semibold text-foreground"
              >
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
