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
  dryRun?: boolean;
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
  const [contentId, setContentId] = useState("");
  const [sort, setSort] = useState("rank");
  const [site, setSite] = useState("FANZA");
  const [service, setService] = useState("doujin");
  const [floor, setFloor] = useState("digital_doujin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FetchSummary | null>(null);
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

  function buildBody(dryRun: boolean, nextHits: number) {
    return {
      action: "start" as const,
      hits: nextHits,
      offset,
      keyword,
      contentId: contentId.trim() || undefined,
      sort,
      site,
      service,
      floor,
      dryRun,
    };
  }

  async function runPreview(nextHits: number) {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const response = await fetch("/api/admin/doujin/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(true, nextHits)),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "プレビューに失敗しました");
      setPreview(json);
      setHits(nextHits);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function confirmAdd() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/doujin/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(false, hits)),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "追加に失敗しました");
      setSummary(json);
      setPreview(null);
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
    <div className="space-y-6" data-site-type="doujin">
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
        <p className="mt-1 text-xs text-muted">
          まず「追加候補を確認」でプレビューし、確認後に「追加を実行」してください。重複は作品ID優先で除外します。
        </p>
        {!writeAllowed ? (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            本番環境では本登録（書き込み）はできません。プレビューは可能です。ローカルで追加後にJSONをGitへコミット・pushしてください。
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm sm:col-span-2 lg:col-span-3">
            作品ID指定（優先）
            <input
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
              placeholder="例: d_123456"
              className="mt-1 w-full rounded border border-border px-3 py-2"
            />
          </label>
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
            検索キーワード
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
              disabled={loading}
              onClick={() => {
                setHits(count);
                void runPreview(count);
              }}
              className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm hover:border-[#F78FA7] hover:text-[#e56b8a] disabled:opacity-50"
            >
              {count}件プレビュー
            </button>
          ))}
          <button
            type="button"
            disabled={loading}
            onClick={() => void runPreview(hits)}
            className="inline-flex h-10 items-center rounded-lg border border-[#F78FA7] bg-[#fff0f4] px-4 text-sm font-medium text-[#e56b8a] disabled:opacity-50"
          >
            {loading ? "確認中..." : "追加候補を確認"}
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

      {preview ? (
        <section className="rounded-lg border border-[#F78FA7] bg-[#fff0f4] p-4 text-sm">
          <h2 className="text-lg font-bold text-[#e56b8a]">追加プレビュー（未書き込み）</h2>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            <li>API取得数: {preview.apiReturnedCount}</li>
            <li>検索総数: {preview.searchTotalCount}</li>
            <li>新規追加予定: {preview.createdCount}</li>
            <li>更新予定: {preview.updatedCount}</li>
            <li>重複除外: {preview.duplicateCount}</li>
            <li>除外（スキップ）: {preview.skippedCount}</li>
            <li>エラー: {preview.errorCount}</li>
          </ul>
          {preview.previewTitles && preview.previewTitles.length > 0 ? (
            <div className="mt-4">
              <p className="font-medium">作品プレビュー（一部）</p>
              <ul className="mt-2 max-h-64 space-y-2 overflow-auto">
                {preview.previewTitles.map((item) => (
                  <li key={item.contentId} className="rounded bg-white p-2">
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
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading || !writeAllowed}
              onClick={() => void confirmAdd()}
              className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? "追加中..." : "追加を実行"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setPreview(null)}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-white px-4 text-sm disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </section>
      ) : null}

      {summary ? (
        <section className="rounded-lg border border-border bg-white p-4 text-sm">
          <h2 className="text-lg font-bold">追加結果</h2>
          <ul className="mt-3 space-y-1">
            <li>API取得数: {summary.apiReturnedCount}</li>
            <li>重複除外: {summary.duplicateCount}</li>
            <li>追加成功（新規）: {summary.createdCount}</li>
            <li>更新: {summary.updatedCount}</li>
            <li>スキップ: {summary.skippedCount}</li>
            <li>エラー: {summary.errorCount}</li>
            <li>次回offset: {summary.nextOffset}</li>
            <li>処理時間: {summary.durationMs}ms</li>
          </ul>
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
