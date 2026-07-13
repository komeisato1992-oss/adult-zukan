"use client";

import { useCallback, useEffect, useState } from "react";

type FetchStats = {
  workCount: number;
  circleCount: number;
  authorCount: number;
  seriesCount: number;
  genreCount: number;
  lastFetchedAt: string | null;
  errorCount: number;
};

type FetchSummary = {
  searchTotalCount: number;
  apiReturnedCount: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  skippedCount: number;
  errorCount: number;
  nextOffset: number;
  durationMs: number;
  previewTitles?: Array<{
    contentId: string;
    title: string;
    circleNames: string[];
    authorNames: string[];
  }>;
  stats?: FetchStats;
  error?: string;
};

export function DoujinFetchClient() {
  const [hits, setHits] = useState(20);
  const [offset, setOffset] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState("rank");
  const [site, setSite] = useState("FANZA");
  const [service, setService] = useState("doujin");
  const [floor, setFloor] = useState("digital_doujin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FetchSummary | null>(null);
  const [stats, setStats] = useState<FetchStats | null>(null);
  const [logs, setLogs] = useState<
    Array<{ at: string; level: string; message: string }>
  >([]);
  const [writeAllowed, setWriteAllowed] = useState(true);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/admin/doujin/fetch");
    if (!response.ok) return;
    const json = await response.json();
    setStats(json.stats ?? null);
    setLogs(json.logs ?? []);
    setWriteAllowed(json.writeAllowed !== false);
    if (json.job?.site) setSite(json.job.site);
    if (json.job?.service) setService(json.job.service);
    if (json.job?.floor) setFloor(json.job.floor);
  }, []);

  useEffect(() => {
    void refreshStatus();
    void fetch("/api/admin/doujin/floors")
      .then((r) => r.json())
      .then((json) => {
        if (json.env?.site) setSite(json.env.site);
        if (json.env?.service) setService(json.env.service);
        if (json.env?.floor) setFloor(json.env.floor);
        else if (json.recommended) {
          setSite(json.recommended.site);
          setService(json.recommended.service);
          setFloor(json.recommended.floor);
        }
      })
      .catch(() => undefined);
  }, [refreshStatus]);

  async function runFetch(nextHits: number) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/doujin/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          hits: nextHits,
          offset,
          keyword,
          sort,
          site,
          service,
          floor,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "取得に失敗しました");
      setSummary(json);
      setStats(json.stats ?? null);
      if (typeof json.nextOffset === "number") setOffset(json.nextOffset);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function stopFetch() {
    await fetch("/api/admin/doujin/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    await refreshStatus();
  }

  return (
    <div className="space-y-6">
      {stats ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["作品数", stats.workCount],
            ["サークル数", stats.circleCount],
            ["作者数", stats.authorCount],
            ["シリーズ数", stats.seriesCount],
            ["ジャンル数", stats.genreCount],
            ["エラー件数", stats.errorCount],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-lg border border-border bg-white p-4"
            >
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
          <div className="rounded-lg border border-border bg-white p-4 sm:col-span-2">
            <p className="text-xs text-muted">最新取得日時</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {stats.lastFetchedAt ?? "未取得"}
            </p>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-white p-4">
        <h2 className="text-lg font-bold">取得条件</h2>
        {!writeAllowed ? (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            本番環境では作品データの直接更新はできません。ローカル環境で同期を実行し、JSONをGitへコミット・pushしてください。
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            取得件数
            <input
              type="number"
              min={1}
              max={500}
              value={hits}
              onChange={(e) => setHits(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded border border-border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            offset
            <input
              type="number"
              min={1}
              value={offset}
              onChange={(e) => setOffset(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded border border-border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            keyword
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="mt-1 w-full rounded border border-border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="mt-1 w-full rounded border border-border px-3 py-2"
            >
              <option value="rank">rank（人気）</option>
              <option value="date">date（新着）</option>
              <option value="price">price（高い順）</option>
              <option value="-price">-price（安い順）</option>
              <option value="review">review（評価）</option>
            </select>
          </label>
          <label className="text-sm">
            site
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="mt-1 w-full rounded border border-border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            service
            <input
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="mt-1 w-full rounded border border-border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            floor
            <input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="mt-1 w-full rounded border border-border px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[1, 20, 50, 100].map((count) => (
            <button
              key={count}
              type="button"
              disabled={loading || !writeAllowed}
              onClick={() => {
                setHits(count);
                void runFetch(count);
              }}
              className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {count}件{count === 1 ? "テスト" : ""}取得
            </button>
          ))}
          <button
            type="button"
            disabled={loading || !writeAllowed}
            onClick={() => void runFetch(hits)}
            className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? "取得中..." : "取得開始"}
          </button>
          <button
            type="button"
            disabled={loading || !writeAllowed}
            onClick={() => void stopFetch()}
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
          >
            取得停止
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {summary ? (
        <section className="rounded-lg border border-border bg-white p-4 text-sm">
          <h2 className="text-lg font-bold">取得結果</h2>
          <ul className="mt-3 space-y-1">
            <li>検索件数: {summary.searchTotalCount}</li>
            <li>API返却件数: {summary.apiReturnedCount}</li>
            <li>新規登録件数: {summary.createdCount}</li>
            <li>更新件数: {summary.updatedCount}</li>
            <li>重複件数: {summary.duplicateCount}</li>
            <li>スキップ件数: {summary.skippedCount}</li>
            <li>エラー件数: {summary.errorCount}</li>
            <li>次回offset: {summary.nextOffset}</li>
            <li>処理時間: {summary.durationMs}ms</li>
          </ul>
          {summary.previewTitles && summary.previewTitles.length > 0 ? (
            <div className="mt-4">
              <p className="font-medium">プレビュー</p>
              <ul className="mt-2 space-y-2">
                {summary.previewTitles.map((item) => (
                  <li key={item.contentId} className="rounded bg-surface p-2">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted">
                      {item.contentId} / サークル:{" "}
                      {item.circleNames.join("、") || "-"} / 作者:{" "}
                      {item.authorNames.join("、") || "作者情報なし"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-white p-4">
        <h2 className="text-lg font-bold">取得履歴</h2>
        <ul className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
          {logs.length === 0 ? (
            <li className="text-muted">履歴はまだありません</li>
          ) : (
            logs.map((log, index) => (
              <li
                key={`${log.at}-${index}`}
                className="rounded border border-border/70 px-3 py-2"
              >
                <span className="text-xs text-muted">{log.at}</span>
                <span className="ml-2 text-xs uppercase text-muted">
                  {log.level}
                </span>
                <p className="mt-1">{log.message}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
