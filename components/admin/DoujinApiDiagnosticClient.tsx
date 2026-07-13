"use client";

import { useEffect, useState } from "react";

type FloorEntry = {
  siteName: string;
  siteCode: string;
  serviceName: string;
  serviceCode: string;
  floorName: string;
  floorCode: string;
};

type DiagnosticResult = {
  floor: { site: string; service: string; floor: string };
  searchTotalCount: number;
  apiReturnedCount: number;
  rawItem: Record<string, unknown> | null;
  normalized: Record<string, unknown> | null;
  iteminfoKeys: string[];
  authorLikeKeys: string[];
  error?: string;
};

export function DoujinApiDiagnosticClient() {
  const [floors, setFloors] = useState<FloorEntry[]>([]);
  const [doujinRelated, setDoujinRelated] = useState<FloorEntry[]>([]);
  const [site, setSite] = useState("");
  const [service, setService] = useState("");
  const [floor, setFloor] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState("rank");
  const [offset, setOffset] = useState(1);
  const [loading, setLoading] = useState(false);
  const [floorLoading, setFloorLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [envHint, setEnvHint] = useState<Record<string, string | undefined>>({});

  async function loadFloors() {
    setFloorLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/doujin/floors");
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "フロア取得に失敗しました");
      setFloors(json.floors ?? []);
      setDoujinRelated(json.doujinRelated ?? []);
      setEnvHint(json.env ?? {});
      if (json.env?.site) setSite(json.env.site);
      if (json.env?.service) setService(json.env.service);
      if (json.env?.floor) setFloor(json.env.floor);
      if (!json.env?.site && json.recommended) {
        setSite(json.recommended.site);
        setService(json.recommended.service);
        setFloor(json.recommended.floor);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFloorLoading(false);
    }
  }

  useEffect(() => {
    void loadFloors();
  }, []);

  async function runDiagnostic() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/doujin/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, service, floor, keyword, sort, offset }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "診断に失敗しました");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function applyFloor(entry: FloorEntry) {
    setSite(entry.siteCode);
    setService(entry.serviceCode);
    setFloor(entry.floorCode);
  }

  const iteminfo =
    result?.rawItem &&
    typeof result.rawItem.iteminfo === "object" &&
    result.rawItem.iteminfo
      ? (result.rawItem.iteminfo as Record<string, unknown>)
      : null;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground">フロア一覧</h2>
          <button
            type="button"
            onClick={() => void loadFloors()}
            disabled={floorLoading}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {floorLoading ? "取得中..." : "フロア再取得"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          環境変数: DMM_DOUJIN_SITE={envHint.site || "(未設定)"} /
          SERVICE={envHint.service || "(未設定)"} / FLOOR=
          {envHint.floor || "(未設定)"}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="px-2 py-2">site</th>
                <th className="px-2 py-2">service</th>
                <th className="px-2 py-2">floor</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {(doujinRelated.length > 0 ? doujinRelated : floors.slice(0, 30)).map(
                (entry) => (
                  <tr
                    key={`${entry.siteCode}-${entry.serviceCode}-${entry.floorCode}`}
                    className="border-b border-border/60"
                  >
                    <td className="px-2 py-2">
                      {entry.siteName}
                      <div className="text-xs text-muted">{entry.siteCode}</div>
                    </td>
                    <td className="px-2 py-2">
                      {entry.serviceName}
                      <div className="text-xs text-muted">{entry.serviceCode}</div>
                    </td>
                    <td className="px-2 py-2">
                      {entry.floorName}
                      <div className="text-xs text-muted">{entry.floorCode}</div>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => applyFloor(entry)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        選択
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-white p-4">
        <h2 className="text-lg font-bold text-foreground">1件診断取得</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <input
              value={sort}
              onChange={(e) => setSort(e.target.value)}
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
        </div>
        <button
          type="button"
          onClick={() => void runDiagnostic()}
          disabled={loading}
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "取得中..." : "1件テスト取得"}
        </button>
      </section>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-4 text-sm">
            <p>
              検索件数(total_count): <strong>{result.searchTotalCount}</strong>
            </p>
            <p>
              API返却件数(result_count):{" "}
              <strong>{result.apiReturnedCount}</strong>
            </p>
            <p>
              iteminfo keys: {result.iteminfoKeys.join(", ") || "(なし)"}
            </p>
            <p>
              作者相当キー: {result.authorLikeKeys.join(", ") || "(なし)"}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-white p-4">
              <h3 className="font-bold">生JSON（秘密情報は除去）</h3>
              <pre className="mt-3 max-h-[480px] overflow-auto rounded bg-surface p-3 text-xs">
                {JSON.stringify(result.rawItem, null, 2)}
              </pre>
            </div>
            <div className="rounded-lg border border-border bg-white p-4">
              <h3 className="font-bold">正規化結果 / iteminfo</h3>
              <pre className="mt-3 max-h-[240px] overflow-auto rounded bg-surface p-3 text-xs">
                {JSON.stringify(result.normalized, null, 2)}
              </pre>
              <h4 className="mt-4 font-bold">iteminfo 全項目</h4>
              <pre className="mt-2 max-h-[200px] overflow-auto rounded bg-surface p-3 text-xs">
                {JSON.stringify(iteminfo, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
