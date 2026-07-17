"use client";

import { useId, useState, type ReactNode } from "react";
import type { OpsDataStatus } from "@/components/admin/ops/ops-dashboard-utils";

const KIND_CLASS: Record<OpsDataStatus["kind"], string> = {
  ok: "border-green-200 bg-green-50 text-green-800",
  refreshing: "border-sky-200 bg-sky-50 text-sky-900",
  unconfigured: "border-border bg-surface/60 text-muted",
  not_fetched: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-300 bg-red-50 text-red-800",
  stale: "border-amber-300 bg-amber-50 text-amber-950",
};

export function OpsDataStatusBanner({ status }: { status: OpsDataStatus }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${KIND_CLASS[status.kind]}`}
    >
      <p className="font-semibold">データ状態: {status.label}</p>
      {status.detail ? <p className="mt-1">{status.detail}</p> : null}
    </div>
  );
}

export function OpsEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-white px-4 py-8 text-center text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900">
      {message}
    </div>
  );
}

export function OpsPeriodButtons<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const useSegment = options.length > 0 && options.length <= 4;

  if (useSegment) {
    return (
      <div
        role="tablist"
        aria-label="期間切り替え"
        className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1 min-[420px]:grid-cols-4"
      >
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={String(option.id)}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.id)}
              className={`min-h-11 rounded-lg px-2 text-sm font-semibold transition ${
                active
                  ? "bg-accent text-white shadow-sm"
                  : "bg-transparent text-muted hover:bg-white hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {options.map((option) => (
        <button
          key={String(option.id)}
          type="button"
          onClick={() => onChange(option.id)}
          className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
            value === option.id
              ? "bg-accent text-white"
              : "border border-border bg-white text-foreground hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-900"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function OpsDetailLink({
  href,
  label = "詳細を見る",
  onClick,
}: {
  href: string;
  label?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={(event) => {
        if (!onClick) return;
        event.preventDefault();
        onClick();
      }}
      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-red-50 sm:px-4"
    >
      {label}
    </a>
  );
}

export function OpsBlockHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-foreground sm:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted sm:text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function OpsSectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-white p-3 shadow-sm sm:p-5 dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      {title ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3">
          <h2 className="text-base font-bold text-foreground sm:text-lg">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * 詳細情報用の折りたたみセクション。
 * スマホでは defaultOpen=false で縦スクロールを抑える想定。
 */
export function OpsCollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="rounded-xl border border-border bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full min-h-12 items-center justify-between gap-3 px-3 py-3 text-left sm:px-5 sm:py-4"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-foreground sm:text-base">
              {title}
            </h3>
            {badge}
          </div>
          {summary && !open ? (
            <p className="mt-0.5 truncate text-xs text-muted">{summary}</p>
          ) : null}
        </div>
        <span
          className="shrink-0 text-xs font-semibold text-accent"
          aria-hidden
        >
          {open ? "閉じる" : "開く"}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="border-t border-border px-3 py-3 sm:px-5 sm:py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
