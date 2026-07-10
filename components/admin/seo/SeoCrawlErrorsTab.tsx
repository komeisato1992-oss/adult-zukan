"use client";

import { useState } from "react";
import { formatSeoNumber } from "@/components/admin/seo/format";
import type { SeoCrawlErrorGroup } from "@/lib/admin/seo-types";

type SeoCrawlErrorsTabProps = {
  crawlErrors: SeoCrawlErrorGroup[];
};

export function SeoCrawlErrorsTab({ crawlErrors }: SeoCrawlErrorsTabProps) {
  const [expandedType, setExpandedType] = useState<string | null>(null);

  if (crawlErrors.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-white px-4 py-6 text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900">
        クロールエラー情報は更新後に表示されます。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {crawlErrors.map((group) => (
          <button
            key={group.type}
            type="button"
            onClick={() =>
              setExpandedType((current) =>
                current === group.type ? null : group.type,
              )
            }
            className={`rounded-xl border bg-white p-5 text-left shadow-sm transition-colors dark:bg-zinc-900 ${
              expandedType === group.type
                ? "border-accent"
                : "border-border dark:border-zinc-700"
            }`}
          >
            <p className="text-sm text-muted">{group.label}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">
              {formatSeoNumber(group.count)}
            </p>
            <p className="mt-2 text-xs text-muted">クリックでURL一覧</p>
          </button>
        ))}
      </div>

      {expandedType ? (
        <section className="rounded-xl border border-border bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="text-base font-bold text-foreground">
            {crawlErrors.find((group) => group.type === expandedType)?.label} の対象URL
          </h3>
          {(() => {
            const urls =
              crawlErrors.find((group) => group.type === expandedType)?.urls ??
              [];
            if (urls.length === 0) {
              return (
                <p className="mt-4 text-sm text-muted">
                  該当するURLはありません。
                </p>
              );
            }
            return (
              <ul className="mt-4 space-y-2 text-sm">
                {urls.map((url) => (
                  <li key={url}>
                    <a
                      href={url.startsWith("http") ? url : undefined}
                      className="break-all text-accent hover:underline [overflow-wrap:anywhere]"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            );
          })()}
        </section>
      ) : null}
    </div>
  );
}
