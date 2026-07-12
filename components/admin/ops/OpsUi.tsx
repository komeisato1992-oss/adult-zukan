"use client";

import type { ReactNode } from "react";
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
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {options.map((option) => (
        <button
          key={String(option.id)}
          type="button"
          onClick={() => onChange(option.id)}
          className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
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
      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-red-50"
    >
      {label}
    </a>
  );
}

export function OpsSectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
