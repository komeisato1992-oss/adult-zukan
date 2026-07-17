"use client";

import { useState } from "react";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import type { OpsSeoScore } from "@/lib/admin/ops-score";

type SeoScoreCardProps = {
  seoScore: OpsSeoScore;
};

export function SeoScoreCard({ seoScore }: SeoScoreCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const unavailable = seoScore.categories.filter((c) => !c.available).length;
  const lowScores = seoScore.categories.filter(
    (c) =>
      c.available &&
      c.points != null &&
      c.maxPoints > 0 &&
      c.points / c.maxPoints < 0.6,
  );
  const criticalItems = lowScores.length + unavailable;

  return (
    <section className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted">SEOスコア</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {seoScore.total == null ? "—" : seoScore.total}
            <span className="ml-2 text-base font-medium text-muted">/ 100</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-surface px-3 py-2">
            <p className="text-[11px] text-muted">要改善</p>
            <p className="font-bold text-foreground">{lowScores.length}件</p>
          </div>
          <div className="rounded-lg bg-surface px-3 py-2">
            <p className="text-[11px] text-muted">重大項目</p>
            <p className="font-bold text-foreground">{criticalItems}件</p>
          </div>
        </div>
      </div>

      {seoScore.partial ? (
        <p className="mt-2 text-xs font-medium text-amber-700">
          一部データ未取得（取得済み {seoScore.earned.toFixed(1)} /{" "}
          {seoScore.availableMax} を100点換算）
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted">
        最終計算: {formatSeoDateTime(seoScore.calculatedAt)}
      </p>

      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border bg-white px-3 text-sm font-semibold text-accent"
        >
          詳細を見る
        </button>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
            {seoScore.categories.map((category) => {
              const open = openKey === category.key;
              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => setOpenKey(open ? null : category.key)}
                  className="min-h-11 rounded-lg border border-border px-3 py-2.5 text-left hover:bg-surface/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">
                      {category.label}
                    </p>
                    <p className="text-xs font-bold text-foreground">
                      {category.available
                        ? `${category.points} / ${category.maxPoints}`
                        : "未取得"}
                    </p>
                  </div>
                  {open ? (
                    <div className="mt-2 space-y-1 border-t border-border pt-2 text-[11px] text-muted">
                      <p>{category.evidence}</p>
                      <p>改善: {category.improvement}</p>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold text-muted"
          >
            閉じる
          </button>
        </>
      )}
    </section>
  );
}
