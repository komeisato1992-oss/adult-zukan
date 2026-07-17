"use client";

import { useState } from "react";
import { alertClass } from "@/components/admin/ops/ops-dashboard-utils";
import type { OpsAlert } from "@/lib/admin/ops-types";

type AlertSummaryCardProps = {
  alerts: OpsAlert[];
  id?: string;
};

export function AlertSummaryCard({
  alerts,
  id = "ops-alerts",
}: AlertSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const issues = alerts.filter(
    (alert) => alert.severity === "critical" || alert.severity === "warning",
  );
  const infoOrSuccess = alerts.filter(
    (alert) => alert.severity === "info" || alert.severity === "success",
  );

  if (issues.length === 0) {
    return (
      <section
        id={id}
        className="rounded-xl border border-green-200 bg-green-50 px-3 py-3 shadow-sm sm:px-4"
      >
        <p className="text-sm font-semibold text-green-800">
          重大な問題は検出されていません
        </p>
        {infoOrSuccess.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 min-h-11 text-xs font-semibold text-green-800 underline-offset-2 hover:underline"
          >
            {expanded ? "補足を閉じる" : `補足情報 ${infoOrSuccess.length}件`}
          </button>
        ) : null}
        {expanded
          ? infoOrSuccess.map((alert) => (
              <div
                key={alert.id}
                className={`mt-2 rounded-lg border p-3 ${alertClass(alert.severity)}`}
              >
                <p className="text-sm font-bold">{alert.title}</p>
                <p className="mt-1 text-xs">{alert.detail}</p>
              </div>
            ))
          : null}
      </section>
    );
  }

  const criticalCount = issues.filter((a) => a.severity === "critical").length;
  const borderClass =
    criticalCount > 0 ? "border-red-300 bg-red-50/70" : "border-amber-300 bg-amber-50/70";

  return (
    <section id={id} className={`rounded-xl border p-3 shadow-sm sm:p-4 ${borderClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground">
            アラート {issues.length}件
            {criticalCount > 0 ? `（重大 ${criticalCount}）` : ""}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-foreground/80">
            {issues
              .slice(0, 2)
              .map((a) => a.title)
              .join(" / ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex min-h-11 items-center rounded-lg border border-border bg-white px-3 text-sm font-semibold text-accent"
        >
          {expanded ? "閉じる" : "詳細を見る"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {issues.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border p-3 ${alertClass(alert.severity)}`}
            >
              <p className="text-sm font-bold">{alert.title}</p>
              <p className="mt-1 text-xs">{alert.detail}</p>
            </div>
          ))}
          {infoOrSuccess.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border p-3 ${alertClass(alert.severity)}`}
            >
              <p className="text-sm font-bold">{alert.title}</p>
              <p className="mt-1 text-xs">{alert.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
