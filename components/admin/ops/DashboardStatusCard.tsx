"use client";

import { formatSeoDateTime } from "@/components/admin/seo/format";
import {
  formatSeoNumber,
  formatYen,
} from "@/components/admin/ops/OpsShared";
import type { OpsAlert, OpsDashboardPayload } from "@/lib/admin/ops-types";

type SiteHealth = "ok" | "warning" | "critical";

function deriveHealth(alerts: OpsAlert[]): {
  health: SiteHealth;
  issueCount: number;
  label: string;
} {
  const issues = alerts.filter(
    (alert) => alert.severity === "critical" || alert.severity === "warning",
  );
  const criticalCount = issues.filter((a) => a.severity === "critical").length;
  if (criticalCount > 0) {
    return {
      health: "critical",
      issueCount: issues.length,
      label: `異常 ${criticalCount}件`,
    };
  }
  if (issues.length > 0) {
    return {
      health: "warning",
      issueCount: issues.length,
      label: `要確認 ${issues.length}件`,
    };
  }
  return { health: "ok", issueCount: 0, label: "正常稼働" };
}

const DOT_CLASS: Record<SiteHealth, string> = {
  ok: "bg-green-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

const CARD_CLASS: Record<SiteHealth, string> = {
  ok: "border-green-200 bg-white",
  warning: "border-amber-300 bg-amber-50/60",
  critical: "border-red-300 bg-red-50/60",
};

type DashboardStatusCardProps = {
  data: OpsDashboardPayload;
  usersToday: number | null;
  pvToday: number | null;
  revenueToday: number | null;
  onOpenAlerts: () => void;
};

export function DashboardStatusCard({
  data,
  usersToday,
  pvToday,
  revenueToday,
  onOpenAlerts,
}: DashboardStatusCardProps) {
  const { health, issueCount, label } = deriveHealth(data.alerts);
  const issueAlerts = data.alerts.filter(
    (alert) => alert.severity === "critical" || alert.severity === "warning",
  );
  const preview = issueAlerts.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpenAlerts}
      className={`w-full rounded-xl border p-3 text-left shadow-sm transition hover:shadow-md sm:p-4 ${CARD_CLASS[health]}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[health]}`}
            aria-hidden
          />
          <p className="text-sm font-bold text-foreground">今日の状態</p>
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        <p className="text-xs text-muted">
          更新 {formatSeoDateTime(data.top.updatedAt)}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="重大アラート"
          value={formatSeoNumber(issueCount)}
        />
        <Stat
          label="本日ユーザー"
          value={usersToday == null ? "—" : formatSeoNumber(usersToday)}
        />
        <Stat
          label="本日PV"
          value={pvToday == null ? "—" : formatSeoNumber(pvToday)}
        />
        <Stat
          label="本日収益"
          value={revenueToday == null ? "—" : formatYen(revenueToday)}
        />
        <Stat
          label="インデックス"
          value={
            data.top.indexedPages == null
              ? "—"
              : formatSeoNumber(data.top.indexedPages)
          }
        />
        <Stat label="サイト状態" value={label} />
      </dl>

      {preview.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-border/70 pt-3">
          {preview.map((alert) => (
            <li key={alert.id} className="truncate text-xs text-foreground">
              ・{alert.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-border/70 pt-3 text-xs text-green-700">
          重大な問題は検出されていません
        </p>
      )}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/80 px-2.5 py-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="truncate text-sm font-bold text-foreground">{value}</dd>
    </div>
  );
}
