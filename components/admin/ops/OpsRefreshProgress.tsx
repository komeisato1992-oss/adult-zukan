"use client";

import {
  OPS_REFRESH_JOB_KEYS,
  OPS_REFRESH_JOB_LABELS,
  formatOpsElapsed,
  type OpsRefreshJobKey,
  type OpsRefreshJobStatus,
} from "@/lib/admin/ops-refresh-client";

export type OpsRefreshJobView = {
  status: OpsRefreshJobStatus;
  detail: string;
};

type OpsRefreshProgressProps = {
  jobs: Record<OpsRefreshJobKey, OpsRefreshJobView>;
  startedAt: number | null;
  elapsedMs: number;
  message: string | null;
};

function statusLabel(status: OpsRefreshJobStatus, detail: string): string {
  switch (status) {
    case "pending":
      return detail || "処理中";
    case "success":
      return "成功";
    case "timeout":
      return "タイムアウト";
    case "error":
      return detail || "失敗";
    default:
      return "待機";
  }
}

function statusClass(status: OpsRefreshJobStatus): string {
  switch (status) {
    case "pending":
      return "text-sky-800";
    case "success":
      return "text-green-700";
    case "timeout":
    case "error":
      return "text-red-700";
    default:
      return "text-muted";
  }
}

export function OpsRefreshProgress({
  jobs,
  startedAt,
  elapsedMs,
  message,
}: OpsRefreshProgressProps) {
  if (!startedAt) return null;

  const activeKeys = OPS_REFRESH_JOB_KEYS.filter(
    (key) => jobs[key].status !== "idle",
  );
  if (activeKeys.length === 0) return null;

  const total = activeKeys.length;
  const done = activeKeys.filter((key) => jobs[key].status !== "pending").length;
  const success = activeKeys.filter((key) => jobs[key].status === "success")
    .length;
  const failed = activeKeys.filter(
    (key) => jobs[key].status === "error" || jobs[key].status === "timeout",
  ).length;
  const pendingKeys = activeKeys.filter((key) => jobs[key].status === "pending");
  const currentLabel =
    pendingKeys.length > 0
      ? pendingKeys
          .map((key) =>
            key === "score"
              ? "SEO処理中"
              : `${OPS_REFRESH_JOB_LABELS[key]}取得中`,
          )
          .join("・")
      : "完了";
  const running = pendingKeys.length > 0;

  return (
    <section
      id="ops-refresh-progress"
      className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="font-semibold">
            {running ? `更新中 ${done} / ${total}` : `更新完了 ${done} / ${total}`}
          </p>
          <p className="text-sky-900">{currentLabel}</p>
          <p className="text-xs text-sky-800 sm:text-sm">
            成功{success} / 失敗{failed}
            <span className="mx-2 text-sky-300">|</span>
            経過 {formatOpsElapsed(elapsedMs)}
          </p>
        </div>
        {message ? (
          <p className="text-xs text-sky-900 sm:max-w-xs sm:text-right sm:text-sm">
            {message}
          </p>
        ) : null}
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {activeKeys.map((key) => {
          const job = jobs[key];
          return (
            <li
              key={key}
              className="rounded-md border border-sky-100 bg-white/80 px-3 py-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">
                  {OPS_REFRESH_JOB_LABELS[key]}
                </span>
                <span className={`shrink-0 text-xs font-semibold ${statusClass(job.status)}`}>
                  {statusLabel(job.status, job.detail)}
                </span>
              </div>
              {job.status !== "pending" &&
              job.status !== "success" &&
              job.detail &&
              job.detail !== "成功" &&
              job.detail !== "タイムアウト" ? (
                <p className="mt-1 text-xs text-muted">{job.detail}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
