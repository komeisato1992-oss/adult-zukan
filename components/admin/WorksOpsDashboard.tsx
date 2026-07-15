"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  CatalogPromoteApiResult,
  CatalogPromoteStatus,
  CatalogPromoteStatusPayload,
} from "@/lib/admin/catalog-promote-types";
import type {
  FanzaSyncHistoryEntry,
  FanzaSyncJob,
} from "@/lib/admin/fanza-sync-types";
import {
  readStoredOffset,
  writeStoredOffset,
} from "@/lib/admin/import-session-storage";
import type {
  AdultImportSortMode,
  FetchedImportCandidate,
  FetchImportCandidatesSummary,
} from "@/lib/admin/import-simple-types";
import { getAdultImportSortLabel } from "@/lib/admin/import-simple-types";
import { buildAddSelectedWorksPayload } from "@/lib/admin/import-add-payload";
import type { AdultSyncMode } from "@/lib/dmm/sync-mode";
import { getAdultSyncModeLabel } from "@/lib/dmm/sync-mode";

type WorksOpsDashboardProps = {
  configured: boolean;
  dmmConfigured: boolean;
  githubConfigured: boolean;
};

type OpsLog = {
  id: string;
  at: string;
  action: string;
  ok: boolean;
  message: string;
  durationMs?: number;
};

const FETCH_COUNTS = [20, 50, 100, 200] as const;

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatDuration(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}秒`;
}

function CardShell({
  step,
  title,
  children,
  tone = "default",
}: {
  step: string;
  title: string;
  children: ReactNode;
  tone?: "default" | "ok" | "warn" | "error";
}) {
  const border =
    tone === "ok"
      ? "border-emerald-400/60 bg-emerald-50/40"
      : tone === "warn"
        ? "border-amber-400/60 bg-amber-50/40"
        : tone === "error"
          ? "border-red-400/60 bg-red-50/40"
          : "border-border bg-surface";

  return (
    <section className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${border}`}>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-bold text-white">
          {step}
        </span>
        <h2 className="text-base font-bold text-foreground sm:text-lg">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function WorksOpsDashboard({
  configured,
  dmmConfigured,
  githubConfigured,
}: WorksOpsDashboardProps) {
  const [promoteStatus, setPromoteStatus] =
    useState<CatalogPromoteStatusPayload | null>(null);
  const [syncJob, setSyncJob] = useState<FanzaSyncJob | null>(null);
  const [syncHistory, setSyncHistory] = useState<FanzaSyncHistoryEntry[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lightSyncEnabled, setLightSyncEnabled] = useState(false);
  const [fullSyncEnabled, setFullSyncEnabled] = useState(false);
  const [logs, setLogs] = useState<OpsLog[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add works
  const [fetchSort, setFetchSort] = useState<AdultImportSortMode>("popular");
  const [fetchCount, setFetchCount] = useState<number>(50);
  const [offsetInput, setOffsetInput] = useState("1");
  const [fetching, setFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [candidates, setCandidates] = useState<FetchedImportCandidate[]>([]);
  const [summary, setSummary] = useState<FetchImportCandidatesSummary | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // Sync / promote
  const [syncMode, setSyncMode] = useState<AdultSyncMode>("light");
  const [syncStarting, setSyncStarting] = useState(false);
  const [syncProcessing, setSyncProcessing] = useState(false);
  const syncProcessingRef = useRef(false);
  const [promoting, setPromoting] = useState(false);
  const [syncingWorking, setSyncingWorking] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [promoteConfirm, setPromoteConfirm] = useState(false);

  const pushLog = useCallback((entry: Omit<OpsLog, "id" | "at">) => {
    setLogs((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          at: new Date().toISOString(),
          ...entry,
        },
        ...prev,
      ].slice(0, 20),
    );
  }, []);

  const refreshPromote = useCallback(async () => {
    const response = await fetch("/api/admin/import/promote/status");
    const body = await response.json();
    if (response.ok && body.success) {
      setPromoteStatus(body.status as CatalogPromoteStatusPayload);
    }
  }, []);

  const refreshSync = useCallback(async () => {
    const response = await fetch("/api/admin/fanza-sync/status");
    if (!response.ok) return null;
    const data = await response.json();
    setSyncJob(data.currentJob);
    setSyncHistory(data.history ?? []);
    setSyncProgress(data.progressPercent ?? 0);
    return data as {
      currentJob: FanzaSyncJob | null;
      history: FanzaSyncHistoryEntry[];
      progressPercent: number;
    };
  }, []);

  const refreshSettings = useCallback(async () => {
    const response = await fetch("/api/admin/ops-settings");
    if (!response.ok) return;
    const data = await response.json();
    setLightSyncEnabled(Boolean(data.lightSyncEnabled));
    setFullSyncEnabled(Boolean(data.fullSyncEnabled));
  }, []);

  useEffect(() => {
    void refreshPromote();
    void refreshSync();
    void refreshSettings();
    setOffsetInput(String(readStoredOffset("popular") || 1));
  }, [refreshPromote, refreshSync, refreshSettings]);

  useEffect(() => {
    setOffsetInput(String(readStoredOffset(fetchSort) || 1));
  }, [fetchSort]);

  const statusTone = useMemo(() => {
    if (promoteStatus?.errorSummary || promoteStatus?.status === "FAILED") {
      return "error" as const;
    }
    if (
      promoteStatus?.hasPendingChanges ||
      (promoteStatus?.productionAheadCount ?? 0) > 0
    ) {
      return "warn" as const;
    }
    return "ok" as const;
  }, [promoteStatus]);

  const processSyncBatch = useCallback(async () => {
    if (syncProcessingRef.current) return;
    syncProcessingRef.current = true;
    setSyncProcessing(true);
    try {
      const response = await fetch("/api/admin/fanza-sync/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "同期バッチの処理に失敗しました。");
      }
      setSyncJob(data.job ?? null);
      setSyncProgress(data.progressPercent ?? 0);
      await refreshSync();
    } finally {
      syncProcessingRef.current = false;
      setSyncProcessing(false);
    }
  }, [refreshSync]);

  useEffect(() => {
    if (
      !syncJob ||
      (syncJob.status !== "running" && syncJob.status !== "pending") ||
      syncProcessing
    ) {
      return;
    }
    void processSyncBatch();
  }, [syncJob, syncProcessing, processSyncBatch]);

  const handleFetchCandidates = async () => {
    setFetching(true);
    setError(null);
    setMessage(null);
    setFetchProgress({ done: 0, total: fetchCount });
    const started = Date.now();
    const startOffset = Math.max(1, Number.parseInt(offsetInput, 10) || 1);

    try {
      // 取得中の擬似進捗（APIが単発のため UI 用）
      const tick = window.setInterval(() => {
        setFetchProgress((prev) => {
          if (!prev) return prev;
          const next = Math.min(prev.total - 1, prev.done + Math.ceil(prev.total / 8));
          return { ...prev, done: next };
        });
      }, 400);

      const response = await fetch("/api/admin/import/fetch-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sort: fetchSort,
          offset: startOffset,
          requestCount: fetchCount,
        }),
      });
      window.clearInterval(tick);
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.message ?? body.error ?? "候補の取得に失敗しました。");
      }

      const nextCandidates = (body.candidates ?? []) as FetchedImportCandidate[];
      const nextSummary = body.summary as FetchImportCandidatesSummary;
      setCandidates(nextCandidates);
      setSummary(nextSummary);
      setSelected(new Set(nextCandidates.map((c) => c.contentId)));
      setFetchProgress({ done: fetchCount, total: fetchCount });

      if (nextSummary?.nextOffset != null) {
        writeStoredOffset(fetchSort, nextSummary.nextOffset);
        setOffsetInput(String(nextSummary.nextOffset));
      }

      setMessage(
        `${getAdultImportSortLabel(fetchSort)}で ${nextCandidates.length} 件の候補を取得しました（作業ブランチのみ）。`,
      );
      pushLog({
        action: "新作品取得",
        ok: true,
        message: `${nextCandidates.length}件`,
        durationMs: Date.now() - started,
      });
      await refreshPromote();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "候補の取得に失敗しました。";
      setError(msg);
      pushLog({ action: "新作品取得", ok: false, message: msg, durationMs: Date.now() - started });
    } finally {
      setFetching(false);
    }
  };

  const handleAddSelected = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    setError(null);
    const started = Date.now();
    try {
      const items = candidates.filter((c) => selected.has(c.contentId));
      const payload = buildAddSelectedWorksPayload(items);
      const response = await fetch("/api/admin/import/add-selected-works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
        summary?: { addedCount?: number };
      };
      if (!response.ok || !body.success) {
        throw new Error(
          body.message || body.error || "作品の追加に失敗しました。",
        );
      }
      const added = Number(body.summary?.addedCount ?? selected.size);
      setMessage(`${added} 件を作業ブランチへ追加しました（本番未反映）。`);
      setCandidates((prev) => prev.filter((c) => !selected.has(c.contentId)));
      setSelected(new Set());
      pushLog({
        action: "作品追加",
        ok: true,
        message: `${added}件追加`,
        durationMs: Date.now() - started,
      });
      await refreshPromote();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "追加に失敗しました。";
      setError(msg);
      pushLog({ action: "作品追加", ok: false, message: msg, durationMs: Date.now() - started });
    } finally {
      setAdding(false);
    }
  };

  const handleStartSync = async (mode: AdultSyncMode) => {
    const needsLight = mode !== "full";
    if (needsLight && !lightSyncEnabled) {
      setError("軽量同期がOFFです。設定画面でONにしてください。");
      return;
    }
    if (mode === "full" && !fullSyncEnabled) {
      setError("完全同期がOFFです。設定画面でONにしてください。");
      return;
    }

    setSyncStarting(true);
    setError(null);
    setMessage(null);
    const started = Date.now();
    try {
      const response = await fetch("/api/admin/fanza-sync/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await response.json();
      if (data.alreadyRunning) {
        setMessage("現在、更新処理を実行中です");
        setSyncJob(data.currentJob);
        return;
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "同期の開始に失敗しました。");
      }
      setMessage(`${getAdultSyncModeLabel(mode)}を開始しました（作業ブランチのみ・本番デプロイなし）。`);
      setSyncJob(data.currentJob);
      setSyncProgress(data.progressPercent ?? 0);
      pushLog({
        action: getAdultSyncModeLabel(mode),
        ok: true,
        message: "開始",
        durationMs: Date.now() - started,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "同期の開始に失敗しました。";
      setError(msg);
      pushLog({
        action: getAdultSyncModeLabel(mode),
        ok: false,
        message: msg,
        durationMs: Date.now() - started,
      });
    } finally {
      setSyncStarting(false);
    }
  };

  const handleSyncWorking = async () => {
    setSyncingWorking(true);
    setError(null);
    setShowConflict(false);
    const started = Date.now();
    try {
      const response = await fetch("/api/admin/import/promote/sync-working", {
        method: "POST",
      });
      const body = await response.json();
      if (body.conflict) {
        setShowConflict(true);
        setError(body.message ?? "競合が発生しました。");
        pushLog({
          action: "作業ブランチ最新化",
          ok: false,
          message: "競合",
          durationMs: Date.now() - started,
        });
        return;
      }
      if (!response.ok || !body.success) {
        throw new Error(body.message ?? "最新化に失敗しました。");
      }
      if (body.status) setPromoteStatus(body.status);
      else await refreshPromote();
      setMessage(body.message ?? "作業ブランチを最新化しました。");
      pushLog({
        action: "作業ブランチ最新化",
        ok: true,
        message: body.message ?? "完了",
        durationMs: Date.now() - started,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "最新化に失敗しました。";
      setError(msg);
      pushLog({
        action: "作業ブランチ最新化",
        ok: false,
        message: msg,
        durationMs: Date.now() - started,
      });
    } finally {
      setSyncingWorking(false);
    }
  };

  const applyPromoteProgress = (next: CatalogPromoteStatus) => {
    setPromoteStatus((prev) =>
      prev
        ? {
            ...prev,
            status: next,
            deployState:
              next === "DEPLOYING" || next === "READY"
                ? "pending"
                : prev.deployState,
          }
        : prev,
    );
  };

  const handlePromote = async () => {
    setPromoting(true);
    setError(null);
    setMessage(null);
    const started = Date.now();
    applyPromoteProgress("VALIDATING");
    try {
      const response = await fetch("/api/admin/import/promote", {
        method: "POST",
        headers: { Accept: "application/x-ndjson, application/json" },
      });
      const contentType = response.headers.get("content-type") ?? "";
      let result: CatalogPromoteApiResult | null = null;

      if (contentType.includes("application/x-ndjson")) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("本番反映レスポンスの読み取りに失敗しました。");
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const event = JSON.parse(trimmed) as {
              type?: string;
              status?: CatalogPromoteStatus;
            } & Partial<CatalogPromoteApiResult>;
            if (event.type === "progress" && event.status) {
              applyPromoteProgress(event.status);
            } else if (event.type === "result") {
              result = event as CatalogPromoteApiResult;
            }
          }
        }
      } else {
        const body = (await response.json()) as CatalogPromoteApiResult;
        result = { ...body, ok: body.ok ?? body.success ?? response.ok };
      }

      if (!result?.ok) {
        if (result?.errorCode === "SYNC_CONFLICT" || result?.errorCode === "MAIN_AHEAD") {
          setShowConflict(true);
        }
        throw new Error(result?.message || "本番反映に失敗しました。");
      }

      setMessage(result.message ?? "本番反映が完了しました。");
      if (result.statusPayload) setPromoteStatus(result.statusPayload);
      else await refreshPromote();
      setPromoteConfirm(false);
      pushLog({
        action: "本番反映",
        ok: true,
        message: "完了",
        durationMs: Date.now() - started,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "本番反映に失敗しました。";
      setError(msg);
      pushLog({
        action: "本番反映",
        ok: false,
        message: msg,
        durationMs: Date.now() - started,
      });
    } finally {
      setPromoting(false);
    }
  };

  const canPromote =
    githubConfigured &&
    Boolean(promoteStatus?.hasPendingChanges) &&
    !promoting &&
    promoteStatus?.status !== "MERGING" &&
    promoteStatus?.status !== "DEPLOYING";

  const syncRunning =
    syncJob?.status === "running" || syncJob?.status === "pending";

  return (
    <div className="space-y-5">
      {message ? (
        <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-foreground">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {/* ① 現在の状態 */}
      <CardShell step="①" title="現在の状態" tone={statusTone}>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-white/70 p-3">
            <dt className="text-xs text-muted">現在の作品数</dt>
            <dd className="mt-1 text-2xl font-bold text-foreground">
              {(promoteStatus?.workingWorkCount ?? 0).toLocaleString()}
            </dd>
          </div>
          <div className="rounded-xl bg-white/70 p-3">
            <dt className="text-xs text-muted">未反映作品数</dt>
            <dd className="mt-1 text-2xl font-bold text-foreground">
              {(promoteStatus?.addedWorkCount ?? 0).toLocaleString()}
            </dd>
          </div>
          <div className="rounded-xl bg-white/70 p-3">
            <dt className="text-xs text-muted">作業ブランチ</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {promoteStatus?.workingBranch ?? "未設定"}
            </dd>
          </div>
          <div className="rounded-xl bg-white/70 p-3">
            <dt className="text-xs text-muted">Production</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {promoteStatus?.productionBranch ?? "main"}
            </dd>
          </div>
          <div className="col-span-2 rounded-xl bg-white/70 p-3 sm:col-span-1">
            <dt className="text-xs text-muted">最終デプロイ日時</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {formatDateTime(promoteStatus?.lastPromoteAt)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm font-medium text-foreground">
          {statusTone === "ok" && "✅ 正常"}
          {statusTone === "warn" && "⚠ 未反映または本番側に更新あり"}
          {statusTone === "error" && "❌ エラーがあります"}
        </p>
        <button
          type="button"
          onClick={() => void refreshPromote()}
          className="mt-3 min-h-[44px] rounded-xl border border-border px-4 text-sm"
        >
          状態を更新
        </button>
      </CardShell>

      {/* ② 新作品追加 */}
      <CardShell step="②" title="新作品追加">
        <p className="mb-3 text-sm text-muted">
          未掲載作品を取得して作業ブランチへ追加します。本番への反映はこの時点では行いません。
        </p>

        <div className="flex gap-2">
          {(["popular", "new"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFetchSort(mode)}
              className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-bold ${
                fetchSort === mode
                  ? "bg-sky-600 text-white"
                  : "border border-border bg-white text-foreground"
              }`}
            >
              {mode === "popular" ? "人気順" : "新着順"}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-muted">取得件数</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {FETCH_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFetchCount(n)}
                className={`min-h-[44px] rounded-xl text-sm font-bold ${
                  fetchCount === n
                    ? "bg-sky-600 text-white"
                    : "border border-border bg-white"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-muted">
            offset（現在位置）
          </span>
          <input
            value={offsetInput}
            onChange={(e) => setOffsetInput(e.target.value)}
            inputMode="numeric"
            className="mt-1 min-h-[48px] w-full rounded-xl border border-border bg-white px-3 text-base"
          />
        </label>
        <p className="mt-1 text-xs text-muted">
          現在位置: {offsetInput || "1"}／
          {fetchSort === "popular" ? "人気" : "新着"}
        </p>

        <button
          type="button"
          disabled={!configured || !dmmConfigured || fetching}
          onClick={() => void handleFetchCandidates()}
          className="mt-4 min-h-[56px] w-full rounded-2xl bg-sky-600 text-base font-bold text-white disabled:opacity-50"
        >
          {fetching
            ? `取得中... ${fetchProgress?.done ?? 0} / ${fetchProgress?.total ?? fetchCount}`
            : `${getAdultImportSortLabel(fetchSort)}で取得`}
        </button>

        {candidates.length > 0 ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                候補 {candidates.length} 件／選択 {selected.size} 件
              </p>
              <button
                type="button"
                disabled={adding || selected.size === 0}
                onClick={() => void handleAddSelected()}
                className="min-h-[44px] rounded-xl bg-sky-600 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {adding ? "追加中…" : "選択作品を追加"}
              </button>
            </div>
            <ul className="max-h-72 space-y-2 overflow-auto rounded-xl border border-border bg-white p-2">
              {candidates.map((c) => {
                const id = c.contentId;
                const checked = selected.has(id);
                return (
                  <li key={id}>
                    <label className="flex min-h-[48px] cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-sky-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          });
                        }}
                        className="mt-1"
                      />
                      <span className="text-sm leading-snug text-foreground">
                        {c.item.title || id}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {summary ? (
              <p className="text-xs text-muted">
                次回offset: {summary.nextOffset ?? "—"}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardShell>

      {/* ③ 掲載作品同期 */}
      <CardShell step="③" title="掲載作品同期">
        <p className="mb-3 text-sm text-muted">
          掲載中作品のデータを作業ブランチ上で更新します。Vercelデプロイはしません。
        </p>

        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-white/80 p-3">
          <div>
            <p className="text-sm font-bold">軽量同期トグル</p>
            <p className="text-xs text-muted">
              {lightSyncEnabled ? "ON（実行可能）" : "OFF"}
            </p>
          </div>
          {lightSyncEnabled ? (
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/admin/ops-settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ lightSyncEnabled: false }),
                });
                await refreshSettings();
              }}
              className="min-h-[44px] rounded-xl bg-sky-600 px-4 text-sm font-bold text-white"
            >
              OFFにする
            </button>
          ) : (
            <Link
              href="/admin/settings"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-amber-500 px-4 text-sm font-bold text-amber-800"
            >
              設定画面へ移動
            </Link>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-sky-300 bg-white p-4">
            <h3 className="font-bold text-foreground">軽量同期</h3>
            <p className="mt-1 text-xs text-muted">価格・セール・評価・順位などを更新</p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["light", "価格・セール・評価・順位"],
                  ["price", "価格だけ更新"],
                  ["rank", "人気順位だけ更新"],
                  ["date", "新着（発売日）だけ更新"],
                ] as const
              ).map(([mode, label]) => (
                <label key={mode} className="flex min-h-[40px] items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="sync-mode"
                    checked={syncMode === mode}
                    onChange={() => setSyncMode(mode)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={
                !configured ||
                !dmmConfigured ||
                syncStarting ||
                syncRunning ||
                !lightSyncEnabled
              }
              onClick={() => void handleStartSync(syncMode === "full" ? "light" : syncMode)}
              className="mt-4 min-h-[48px] w-full rounded-xl bg-sky-600 font-bold text-white disabled:opacity-50"
            >
              {syncRunning && syncJob?.mode !== "full"
                ? `更新中… ${syncJob?.processedCount ?? 0} / ${syncJob?.targetCount ?? 0}`
                : "軽量同期を実行"}
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <h3 className="font-bold text-foreground">完全同期</h3>
            <p className="mt-1 text-xs text-muted">
              タイトル・画像・出演者など全データを再取得（高負荷）
            </p>
            {!fullSyncEnabled ? (
              <Link
                href="/admin/settings"
                className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-amber-500 text-sm font-bold text-amber-800"
              >
                設定画面へ移動
              </Link>
            ) : (
              <button
                type="button"
                disabled={
                  !configured || !dmmConfigured || syncStarting || syncRunning
                }
                onClick={() => void handleStartSync("full")}
                className="mt-4 min-h-[48px] w-full rounded-xl bg-sky-700 font-bold text-white disabled:opacity-50"
              >
                {syncRunning && syncJob?.mode === "full"
                  ? `更新中… ${syncJob?.processedCount ?? 0} / ${syncJob?.targetCount ?? 0}`
                  : "完全同期を実行"}
              </button>
            )}
          </div>
        </div>

        {syncRunning ? (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-sky-100">
              <div
                className="h-full bg-sky-600 transition-all"
                style={{ width: `${Math.min(100, syncProgress)}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted">
              取得中... {syncJob?.processedCount ?? 0} / {syncJob?.targetCount ?? 0}
            </p>
          </div>
        ) : null}
      </CardShell>

      {/* ④ 本番反映 */}
      <CardShell
        step="④"
        title="本番反映"
        tone={
          (promoteStatus?.productionAheadCount ?? 0) > 0
            ? "warn"
            : promoteStatus?.hasPendingChanges
              ? "ok"
              : "default"
        }
      >
        <p className="text-base font-bold text-foreground">
          {(promoteStatus?.productionAheadCount ?? 0) > 0
            ? "⚠ 本番に更新があります"
            : promoteStatus?.hasPendingChanges
              ? "✅ 本番反映できます"
              : "反映できる変更はありません"}
        </p>
        <p className="mt-2 text-sm text-muted">
          ここで初めて本番サイトへ反映し、Vercelデプロイを1回だけ実行します。
        </p>

        {(promoteStatus?.productionAheadCount ?? 0) > 0 || showConflict ? (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              disabled={!githubConfigured || syncingWorking || promoting}
              onClick={() => void handleSyncWorking()}
              className="min-h-[48px] w-full rounded-xl bg-sky-600 font-bold text-white disabled:opacity-50"
            >
              {syncingWorking ? "最新化中…" : "作業ブランチを最新化"}
            </button>
            {showConflict ? (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-bold">競合が発生しました</p>
                <p className="mt-1">
                  自動取り込みできない変更があります。「作業内容を破棄」するか、手動で解消してから再度お試しください。
                </p>
                <button
                  type="button"
                  disabled={promoting}
                  onClick={async () => {
                    const confirmText = "未反映の変更を破棄";
                    const response = await fetch(
                      "/api/admin/import/promote/discard",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ confirmText }),
                      },
                    );
                    const body = await response.json();
                    if (!response.ok || !body.success) {
                      setError(body.error ?? body.message ?? "破棄に失敗しました。");
                      return;
                    }
                    setShowConflict(false);
                    setMessage("作業内容を破棄し、本番状態に戻しました。");
                    if (body.status) setPromoteStatus(body.status);
                    else await refreshPromote();
                  }}
                  className="mt-3 min-h-[44px] rounded-xl bg-red-600 px-4 font-bold text-white"
                >
                  作業内容を破棄して本番に合わせる
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!canPromote}
            onClick={() => setPromoteConfirm(true)}
            className="min-h-[52px] flex-1 rounded-xl bg-sky-600 font-bold text-white disabled:opacity-40"
          >
            {promoting ? "反映中…" : "本番反映する"}
          </button>
          <button
            type="button"
            disabled={!githubConfigured || syncingWorking}
            onClick={() => void handleSyncWorking()}
            className="min-h-[52px] flex-1 rounded-xl border border-border bg-white font-medium disabled:opacity-50"
          >
            作業ブランチを最新化
          </button>
        </div>

        {promoteConfirm ? (
          <div className="mt-4 rounded-xl border border-border bg-white p-4 text-sm">
            <p className="font-bold">本番サイトへ反映しますか？</p>
            <ul className="mt-2 space-y-1 text-muted">
              <li>追加作品：{(promoteStatus?.addedWorkCount ?? 0).toLocaleString()}件</li>
              <li>更新作品：{(promoteStatus?.updatedWorkCount ?? 0).toLocaleString()}件</li>
            </ul>
            <p className="mt-2 text-muted">
              反映前に自動で最新化 → マージ → デプロイ（1回）を行います。
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={promoting}
                onClick={() => setPromoteConfirm(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-border"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={promoting}
                onClick={() => void handlePromote()}
                className="min-h-[44px] flex-1 rounded-xl bg-sky-600 font-bold text-white"
              >
                {promoting ? "実行中…" : "実行する"}
              </button>
            </div>
          </div>
        ) : null}
      </CardShell>

      {/* ⑤ ログ */}
      <CardShell step="⑤" title="実行ログ">
        {logs.length === 0 && syncHistory.length === 0 ? (
          <p className="text-sm text-muted">まだ実行履歴はありません。</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {log.ok ? "✅" : "❌"} {log.action}
                  </span>
                  <span className="text-xs text-muted">
                    {formatDuration(log.durationMs)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDateTime(log.at)} / {log.message}
                </p>
              </li>
            ))}
            {syncHistory.slice(0, 5).map((entry) => {
              const duration =
                entry.completedAt && entry.startedAt
                  ? Date.parse(entry.completedAt) - Date.parse(entry.startedAt)
                  : undefined;
              const ok =
                entry.status === "completed" || entry.status === "partial_failed";
              return (
                <li
                  key={entry.jobId}
                  className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {ok ? "✅" : "❌"} 同期ジョブ
                    </span>
                    <span className="text-xs text-muted">
                      {formatDuration(duration)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(entry.completedAt ?? entry.startedAt)} /
                    更新 {entry.updatedCount} / エラー {entry.errorCount}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardShell>
    </div>
  );
}
