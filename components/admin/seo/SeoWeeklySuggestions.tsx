"use client";

import { SeoSectionHeading } from "@/components/admin/seo/SeoSectionHeading";
import type { SeoChanceTabId, SeoTabId, SeoWeeklySuggestion } from "@/lib/admin/seo-types";

type SeoWeeklySuggestionsProps = {
  suggestions: SeoWeeklySuggestion[];
  onNavigate?: (options: {
    tab?: SeoTabId;
    chanceTab?: SeoChanceTabId;
  }) => void;
};

export function SeoWeeklySuggestions({
  suggestions,
  onNavigate,
}: SeoWeeklySuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <section className="space-y-4">
      <SeoSectionHeading title="今週のSEO提案" />

      <div className="grid gap-3 lg:grid-cols-2">
        {suggestions.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <p className="text-sm text-foreground">{item.text}</p>
            {item.targetTab || item.targetChanceTab ? (
              <button
                type="button"
                onClick={() =>
                  onNavigate?.({
                    tab: item.targetTab,
                    chanceTab: item.targetChanceTab,
                  })
                }
                className="mt-2 text-xs text-accent underline"
              >
                対象を見る
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
