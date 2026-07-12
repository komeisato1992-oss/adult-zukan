"use client";

import { useCallback, useState } from "react";

type Breakdown = {
  workCount: number;
  workPopularityScoreSum: number;
  popularWorkCount: number;
  recentNewCount: number;
  saleWorkCount: number;
  finalScore: number;
};

type TopRow = {
  name: string;
  workCount: number;
  score: number;
  breakdown: Breakdown;
};

export function EntityRankingAdminClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [top, setTop] = useState<{
    actresses: TopRow[];
    makers: TopRow[];
    series: TopRow[];
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/entity-ranking", {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "再集計に失敗しました。");
      }
      setUpdatedAt(body.updatedAt);
      setTop(body.top);
    } catch (err) {
      setError(err instanceof Error ? err.message : "再集計に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold">エンティティランキング</h1>
        <p className="mt-2 text-sm text-muted">
          カタログ実データから人気女優・メーカー・シリーズを再集計します。ダミーデータは使用しません。
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "再集計中…" : "ランキングを再集計"}
        </button>
        {updatedAt ? (
          <p className="mt-3 text-xs text-muted">updatedAt: {updatedAt}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      {top
        ? (["actresses", "makers", "series"] as const).map((key) => (
            <section
              key={key}
              className="rounded-xl border border-border bg-white p-4 shadow-sm"
            >
              <h2 className="text-sm font-bold">
                {key === "actresses"
                  ? "人気女優 TOP10"
                  : key === "makers"
                    ? "人気メーカー TOP10"
                    : "人気シリーズ TOP10"}
              </h2>
              <ol className="mt-3 space-y-2 text-sm">
                {top[key].map((row, index) => (
                  <li key={row.name} className="rounded border border-border p-2">
                    <p className="font-medium">
                      {index + 1}. {row.name}（{row.workCount}作品） score=
                      {row.score}
                    </p>
                    <p className="text-xs text-muted">
                      人気合計 {row.breakdown.workPopularityScoreSum} / 人気作品{" "}
                      {row.breakdown.popularWorkCount} / 新作{" "}
                      {row.breakdown.recentNewCount} / セール{" "}
                      {row.breakdown.saleWorkCount}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))
        : null}
    </div>
  );
}
