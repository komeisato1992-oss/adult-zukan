"use client";

import Image from "next/image";
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
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemMakerName,
} from "@/lib/dmm/display";
import { formatDmmItemPrice } from "@/lib/dmm/release-date";

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
  detail?: string;
};

type LightSyncStatus = "enabled" | "disabled" | "unset";
type StepId = 1 | 2 | 3 | 4;

const FETCH_COUNTS = [20, 50, 100, 200] as const;
const STEPS: Array<{ id: StepId; short: string; label: string }> = [
  { id: 1, short: "1. 候補取得", label: "作品を探す" },
  { id: 2, short: "2. 選択・追加", label: "選択して追加する" },
  { id: 3, short: "3. 更新", label: "掲載作品を更新する" },
  { id: 4, short: "4. 反映不要", label: "本番反映は不要" },
];

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

function statusLabel(status: LightSyncStatus): string {
  if (status === "enabled") return "有効：実行可能";
  if (status === "disabled") return "無効：設定が必要";
  return "未設定：環境変数未設定";
}

function CardShell({
  step,
  title,
  children,
  tone = "default",
  id,
}: {
  step: string;
  title: string;
  children: ReactNode;
  tone?: "default" | "ok" | "warn" | "error" | "info";
  id?: string;
}) {
  const border =
    tone === "ok"
      ? "border-emerald-400/70 bg-emerald-50/50"
      : tone === "warn"
        ? "border-amber-400/70 bg-amber-50/50"
        : tone === "error"
          ? "border-red-400/70 bg-red-50/50"
          : tone === "info"
            ? "border-sky-400/70 bg-sky-50/40"
            : "border-border bg-surface";

  return (
    <section
      id={id}
      className={`scroll-mt-24 rounded-2xl border p-4 shadow-sm sm:p-5 ${border}`}
    >
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
  const [activeStep, setActiveStep] = useState<StepId>(1);
  const [promoteStatus, setPromoteStatus] =
    useState<CatalogPromoteStatusPayload | null>(null);
  const [syncJob, setSyncJob] = useState<FanzaSyncJob | null>(null);
  const [syncHistory, setSyncHistory] = useState<FanzaSyncHistoryEntry[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lightSyncEnabled, setLightSyncEnabled] = useState(false);
  const [lightSyncStatus, setLightSyncStatus] =
    useState<LightSyncStatus>("unset");
  const [fullSyncEnabled, setFullSyncEnabled] = useState(false);
  const [logs, setLogs] = useState<OpsLog[]>([]);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTechDetail, setShowTechDetail] = useState(false);
  const [liveStorage, setLiveStorage] = useState<{
    backend: string;
    label: string;
    rowCount: number;
  } | null>(null);
  const [worksMasterStorage, setWorksMasterStorage] = useState<{
    backend: string;
    label: string;
    rowCount: number;
  } | null>(null);
  const [lastAddStatus, setLastAddStatus] = useState<{
    completed: boolean;
    publishedStatus: "published" | "draft" | null;
    storageLabel: string | null;
  } | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<{
    requestedCount: number | null;
    dbFetchMs: number | null;
    jsonFallbackCount: number | null;
    cacheHitRate: number | null;
    totalMs: number | null;
  } | null>(null);
  const [syncTargetLimit, setSyncTargetLimit] = useState<number | null>(null);

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
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(
    null,
  );

  const [syncMode, setSyncMode] = useState<AdultSyncMode>("price");
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
      ].slice(0, 40),
    );
  }, []);

  const refreshPromote = useCallback(async () => {
    const response = await fetch("/api/admin/import/promote/status", {
      cache: "no-store",
    });
    const body = await response.json();
    if (response.ok && body.success) {
      setPromoteStatus(body.status as CatalogPromoteStatusPayload);
    }
  }, []);

  const refreshSync = useCallback(async () => {
    const response = await fetch("/api/admin/fanza-sync/status", {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    setSyncJob(data.currentJob);
    setSyncHistory(data.history ?? []);
    setSyncProgress(data.progressPercent ?? 0);
    if (data.storage) {
      setLiveStorage({
        backend: String(data.storage.backend ?? ""),
        label: String(data.storage.label ?? ""),
        rowCount: Number(data.storage.rowCount ?? 0),
      });
    }
    if (data.worksMaster) {
      setWorksMasterStorage({
        backend: String(data.worksMaster.backend ?? ""),
        label: String(data.worksMaster.label ?? ""),
        rowCount: Number(data.worksMaster.rowCount ?? 0),
      });
    }
    if (data.metrics) {
      const last = data.metrics.last as
        | {
            requestedCount?: number;
            dbFetchMs?: number;
            jsonFallbackCount?: number;
            totalMs?: number;
          }
        | null
        | undefined;
      setLiveMetrics({
        requestedCount: last?.requestedCount ?? null,
        dbFetchMs: last?.dbFetchMs ?? null,
        jsonFallbackCount: last?.jsonFallbackCount ?? null,
        cacheHitRate:
          typeof data.metrics.cacheHitRate === "number"
            ? data.metrics.cacheHitRate
            : null,
        totalMs: last?.totalMs ?? null,
      });
    }
    setSyncTargetLimit(
      data.syncTargetLimit == null ? null : Number(data.syncTargetLimit),
    );
    return data as {
      currentJob: FanzaSyncJob | null;
      history: FanzaSyncHistoryEntry[];
      progressPercent: number;
    };
  }, []);

  const refreshSettings = useCallback(async () => {
    const response = await fetch("/api/admin/ops-settings", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = await response.json();
    setLightSyncEnabled(Boolean(data.lightSyncEnabled));
    setFullSyncEnabled(Boolean(data.fullSyncEnabled));
    if (
      data.lightSyncStatus === "enabled" ||
      data.lightSyncStatus === "disabled" ||
      data.lightSyncStatus === "unset"
    ) {
      setLightSyncStatus(data.lightSyncStatus);
    } else {
      setLightSyncStatus(
        data.lightSyncEnabled ? "enabled" : data.lightSyncEnv === "unset"
          ? "unset"
          : "disabled",
      );
    }
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

  const syncRunning =
    syncJob?.status === "running" || syncJob?.status === "pending";

  const health = useMemo(() => {
    if (syncRunning || promoting || syncingWorking) {
      return { tone: "info" as const, label: "処理中" };
    }
    if (promoteStatus?.errorSummary || promoteStatus?.status === "FAILED") {
      return { tone: "error" as const, label: "要対応" };
    }
    if ((promoteStatus?.productionAheadCount ?? 0) > 0) {
      return { tone: "warn" as const, label: "要対応" };
    }
    if (promoteStatus?.hasPendingChanges) {
      return { tone: "warn" as const, label: "未反映あり" };
    }
    return { tone: "ok" as const, label: "正常" };
  }, [promoteStatus, syncRunning, promoting, syncingWorking]);

  const userStatusMessage = useMemo(() => {
    if (syncRunning) return "掲載作品の更新を実行中です";
    if (promoting) return "本番反映を実行中です";
    if (syncingWorking) return "作業内容を最新状態へ合わせています";
    if ((promoteStatus?.productionAheadCount ?? 0) > 0) {
      return "本番側に新しい変更があります。作業内容を最新状態へ合わせる必要があります";
    }
    if (promoteStatus?.hasPendingChanges) {
      return "作業ブランチに未反映の変更があります";
    }
    if (promoteStatus?.errorSummary) return "要対応のエラーがあります";
    return "問題なく運用できます";
  }, [promoteStatus, syncRunning, promoting, syncingWorking]);

  const lastSyncAt =
    syncJob?.completedAt ||
    syncJob?.updatedAt ||
    syncHistory[0]?.completedAt ||
    syncHistory[0]?.startedAt ||
    null;

  const processSyncBatch = useCallback(async () => {
    if (syncProcessingRef.current) return;
    syncProcessingRef.current = true;
    setSyncProcessing(true);
    try {
      const response = await fetch("/api/admin/fanza-sync/process", {
        method: "POST",
        cache: "no-store",
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

  const currentOffset = Math.max(1, Number.parseInt(offsetInput, 10) || 1);

  const handleFetchCandidates = async () => {
    setFetching(true);
    setError(null);
    setMessage(null);
    setFetchProgress({ done: 0, total: fetchCount });
    const started = Date.now();
    const startOffset = currentOffset;

    try {
      const tick = window.setInterval(() => {
        setFetchProgress((prev) => {
          if (!prev) return prev;
          const next = Math.min(prev.total - 1, prev.done + Math.ceil(prev.total / 8));
          return { ...prev, done: next };
        });
      }, 400);

      const response = await fetch("/api/admin/import/fetch-candidates", {
        method: "POST",
        cache: "no-store",
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
      setActiveStep(2);

      if (nextSummary?.nextOffset != null) {
        writeStoredOffset(fetchSort, nextSummary.nextOffset);
        setOffsetInput(String(nextSummary.nextOffset));
      }

      setMessage(
        `${getAdultImportSortLabel(fetchSort)}で未掲載候補 ${nextCandidates.length} 件を取得しました。`,
      );
      pushLog({
        action: "候補取得",
        ok: true,
        message: `${nextCandidates.length}件`,
        durationMs: Date.now() - started,
        detail: JSON.stringify(nextSummary),
      });
      await refreshPromote();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "候補の取得に失敗しました。";
      setError(msg);
      pushLog({
        action: "候補取得",
        ok: false,
        message: msg,
        durationMs: Date.now() - started,
        detail: msg,
      });
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
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
        summary?: {
          addedCount?: number;
          storageLabel?: string;
          publishedStatus?: "published" | "draft";
          worksMasterUpserted?: boolean;
        };
      };
      if (!response.ok || !body.success) {
        throw new Error(
          body.message || body.error || "作品の追加に失敗しました。",
        );
      }
      const added = Number(body.summary?.addedCount ?? selected.size);
      const storageLabel =
        body.summary?.storageLabel ??
        worksMasterStorage?.label ??
        "Supabase";
      const publishedStatus = body.summary?.publishedStatus ?? "published";
      setLastAddStatus({
        completed: true,
        publishedStatus,
        storageLabel,
      });
      setMessage(
        body.message ??
          [
            "作品追加完了",
            `保存先：${storageLabel}`,
            publishedStatus === "draft" ? "下書き" : "公開済み",
            `${added} 件を作品マスターへ保存しました（デプロイなし）。`,
          ].join("\n"),
      );
      if (typeof body.summary?.addedCount === "number") {
        setWorksMasterStorage((prev) =>
          prev
            ? {
                ...prev,
                rowCount: Math.max(prev.rowCount, prev.rowCount + added),
              }
            : prev,
        );
      }
      setCandidates((prev) => prev.filter((c) => !selected.has(c.contentId)));
      setSelected(new Set());
      setActiveStep(4);
      pushLog({
        action: "作品追加",
        ok: true,
        message: `${added}件 / ${storageLabel}`,
        durationMs: Date.now() - started,
      });
      await refreshPromote();
      await refreshSync();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "追加に失敗しました。";
      setError(msg);
      pushLog({
        action: "作品追加",
        ok: false,
        message: msg,
        durationMs: Date.now() - started,
        detail: msg,
      });
    } finally {
      setAdding(false);
    }
  };

  const handleStartSync = async (mode: AdultSyncMode) => {
    if (mode !== "full" && !lightSyncEnabled) {
      setError("軽量同期が無効です。設定画面で有効にするか、環境変数を確認してください。");
      return;
    }
    if (mode === "full" && !fullSyncEnabled) {
      setError("完全同期が無効です。設定画面で有効にしてください。");
      return;
    }
    if (syncRunning) {
      setMessage("現在、更新処理を実行中です");
      return;
    }

    setSyncStarting(true);
    setError(null);
    setMessage(null);
    const started = Date.now();
    try {
      const response = await fetch("/api/admin/fanza-sync/start", {
        method: "POST",
        cache: "no-store",
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
      setMessage(
        `${getAdultSyncModeLabel(mode)}を開始しました（DB直接更新・デプロイなし）。`,
      );
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
        detail: msg,
      });
    } finally {
      setSyncStarting(false);
    }
  };

  const handleResumeSync = async () => {
    if (syncRunning) {
      setMessage("現在、更新処理を実行中です");
      return;
    }
    setSyncStarting(true);
    setError(null);
    setMessage(null);
    const started = Date.now();
    try {
      const response = await fetch("/api/admin/fanza-sync/resume", {
        method: "POST",
        cache: "no-store",
      });
      const data = await response.json();
      if (data.alreadyRunning) {
        setMessage("現在、更新処理を実行中です");
        setSyncJob(data.currentJob);
        return;
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "途中再開に失敗しました。");
      }
      setMessage(data.message ?? "途中から再開しました（デプロイなし）。");
      setSyncJob(data.currentJob);
      setSyncProgress(data.progressPercent ?? 0);
      pushLog({
        action: "同期再開",
        ok: true,
        message: "再開",
        durationMs: Date.now() - started,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "途中再開に失敗しました。";
      setError(msg);
      pushLog({
        action: "同期再開",
        ok: false,
        message: msg,
        durationMs: Date.now() - started,
        detail: msg,
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
        cache: "no-store",
      });
      const body = await response.json();
      if (body.conflict) {
        setShowConflict(true);
        setError(
          "作業内容を最新状態へ合わせる際に競合が発生しました。詳細を確認してください。",
        );
        pushLog({
          action: "作業ブランチ最新化",
          ok: false,
          message: "競合",
          durationMs: Date.now() - started,
          detail: body.message,
        });
        return;
      }
      if (!response.ok || !body.success) {
        throw new Error(body.message ?? "最新化に失敗しました。");
      }
      if (body.status) setPromoteStatus(body.status);
      else await refreshPromote();
      setMessage(body.message ?? "作業内容を最新状態へ合わせました。");
      pushLog({
        action: "作業ブランチ最新化",
        ok: true,
        message: "完了",
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
        detail: msg,
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
        cache: "no-store",
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

      setMessage(result.message ?? "本番反映が完了しました（Productionデプロイ1回）。");
      if (result.statusPayload) setPromoteStatus(result.statusPayload);
      else await refreshPromote();
      setPromoteConfirm(false);
      pushLog({
        action: "本番反映",
        ok: true,
        message: "デプロイ1回",
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
        detail: msg,
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

  const visibleLogs = showAllLogs ? logs : logs.slice(0, 5);
  const toneClass =
    health.tone === "ok"
      ? "bg-emerald-500"
      : health.tone === "warn"
        ? "bg-amber-500"
        : health.tone === "info"
          ? "bg-sky-500"
          : "bg-red-500";

  return (
    <div className="space-y-4 pb-28 sm:pb-8">
      {/* 現在の状態 */}
      <CardShell
        step="状態"
        title="現在の状態"
        tone={
          health.tone === "info"
            ? "info"
            : health.tone === "ok"
              ? "ok"
              : health.tone === "warn"
                ? "warn"
                : "error"
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold text-white ${toneClass}`}
          >
            {health.label}
          </span>
          <p className="text-sm font-medium text-foreground">{userStatusMessage}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-xl bg-white/80 p-3">
            <dt className="text-xs text-muted">公開作品数</dt>
            <dd className="mt-1 text-xl font-bold">
              {(promoteStatus?.workingWorkCount ?? 0).toLocaleString()}
            </dd>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <dt className="text-xs text-muted">作業中の追加</dt>
            <dd className="mt-1 text-xl font-bold">
              {(promoteStatus?.addedWorkCount ?? 0).toLocaleString()}
            </dd>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <dt className="text-xs text-muted">未反映コミット</dt>
            <dd className="mt-1 text-xl font-bold">
              {(promoteStatus?.pendingCommitCount ?? 0).toLocaleString()}
            </dd>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <dt className="text-xs text-muted">処理状態</dt>
            <dd className="mt-1 text-sm font-bold">{health.label}</dd>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <dt className="text-xs text-muted">作業ブランチ</dt>
            <dd className="mt-1 truncate font-semibold">
              {promoteStatus?.workingBranch ?? "未設定"}
            </dd>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <dt className="text-xs text-muted">本番ブランチ</dt>
            <dd className="mt-1 truncate font-semibold">
              {promoteStatus?.productionBranch ?? "main"}
            </dd>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <dt className="text-xs text-muted">最終同期</dt>
            <dd className="mt-1 text-xs font-semibold">
              {formatDateTime(lastSyncAt)}
            </dd>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <dt className="text-xs text-muted">最終本番反映</dt>
            <dd className="mt-1 text-xs font-semibold">
              {formatDateTime(promoteStatus?.lastPromoteAt)}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => setShowTechDetail((v) => !v)}
          className="mt-3 text-xs text-sky-700 underline"
        >
          {showTechDetail ? "技術詳細を閉じる" : "技術詳細を開く"}
        </button>
        {showTechDetail ? (
          <pre className="mt-2 overflow-auto rounded-xl bg-zinc-900 p-3 text-[11px] text-zinc-100">
            {JSON.stringify(
              {
                errorCode: promoteStatus?.errorCode,
                httpStatus: promoteStatus?.httpStatus,
                status: promoteStatus?.status,
                productionAheadCount: promoteStatus?.productionAheadCount,
                syncJobId: syncJob?.jobId,
                syncStatus: syncJob?.status,
              },
              null,
              2,
            )}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void refreshPromote();
            void refreshSync();
            void refreshSettings();
          }}
          className="mt-3 min-h-[44px] rounded-xl border border-border px-4 text-sm"
        >
          状態を更新
        </button>
      </CardShell>

      {/* ステップナビ */}
      <nav
        aria-label="作品管理の手順"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {STEPS.map((step) => {
          const active = activeStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                setActiveStep(step.id);
                document
                  .getElementById(`works-ops-step-${step.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold sm:text-sm ${
                active
                  ? "bg-sky-600 text-white"
                  : "border border-border bg-white text-foreground"
              }`}
            >
              {step.short}
            </button>
          );
        })}
      </nav>

      {message ? (
        <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {/* ① 作品を探す */}
      <CardShell
        id="works-ops-step-1"
        step="①"
        title="作品を探す"
        tone={activeStep === 1 ? "info" : "default"}
      >
        <p className="mb-3 text-sm text-muted">
          未掲載作品を取得します。この操作では本番デプロイはしません。
        </p>

        <div className="grid grid-cols-2 gap-2">
          {(["popular", "new"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFetchSort(mode)}
              className={`min-h-[48px] rounded-xl text-sm font-bold ${
                fetchSort === mode
                  ? "bg-sky-600 text-white"
                  : "border border-border bg-white"
              }`}
            >
              {mode === "popular" ? "人気順" : "新着順"}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-medium text-muted">取得件数</p>
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

        <div className="mt-4 rounded-2xl border border-border bg-white p-3">
          <p className="text-xs text-muted">offset（現在位置）</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{currentOffset}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              className="min-h-[44px] rounded-xl border border-border text-sm font-medium"
              onClick={() =>
                setOffsetInput(String(Math.max(1, currentOffset - fetchCount)))
              }
            >
              前へ
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-xl border border-border text-sm font-medium"
              onClick={() => setOffsetInput(String(currentOffset + fetchCount))}
            >
              次へ
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-xl border border-border text-sm font-medium"
              onClick={() => {
                setOffsetInput("1");
                writeStoredOffset(fetchSort, 1);
              }}
            >
              0に戻す
            </button>
            <input
              value={offsetInput}
              onChange={(e) => setOffsetInput(e.target.value)}
              inputMode="numeric"
              aria-label="offsetを直接入力"
              className="min-h-[44px] rounded-xl border border-border px-3 text-center text-base"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={!configured || !dmmConfigured || fetching || syncRunning || adding || promoting}
          onClick={() => void handleFetchCandidates()}
          className="mt-4 min-h-[56px] w-full rounded-2xl bg-sky-600 text-base font-bold text-white disabled:opacity-50"
        >
          {fetching
            ? `取得中 ${fetchProgress?.done ?? 0} / ${fetchProgress?.total ?? fetchCount}`
            : "未掲載作品を取得"}
        </button>

        {fetching || summary ? (
          <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-950">
            <p>
              取得中 {fetchProgress?.done ?? summary?.requestedCount ?? 0} /{" "}
              {fetchProgress?.total ?? summary?.requestedCount ?? fetchCount}
            </p>
            <p>重複除外 {summary?.duplicateExcludedCount ?? 0}件</p>
            <p>
              未掲載候補{" "}
              {summary?.candidateCount ?? candidates.length}件
              {summary
                ? `（掲載除外 ${summary.publishedExcludedCount}）`
                : null}
            </p>
          </div>
        ) : null}
      </CardShell>

      {/* ② 選択して追加 */}
      <CardShell
        id="works-ops-step-2"
        step="②"
        title="選択して追加する"
        tone={activeStep === 2 ? "info" : "default"}
      >
        <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          <p className="font-bold">
            保存先：{worksMasterStorage?.label ?? "Supabase"}
          </p>
          <p className="mt-1 text-xs">
            新規作品は作品マスターへ直接保存します。Git・JSON・デプロイは発生しません。
          </p>
          {typeof worksMasterStorage?.rowCount === "number" ? (
            <p className="mt-1 text-xs">
              マスター件数：{worksMasterStorage.rowCount.toLocaleString()}件
            </p>
          ) : null}
          {lastAddStatus?.completed ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-emerald-600 px-2 py-1 text-white">
                作品追加完了
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-sky-900">
                保存先：{lastAddStatus.storageLabel ?? "Supabase"}
              </span>
              <span
                className={`rounded-full px-2 py-1 ${
                  lastAddStatus.publishedStatus === "draft"
                    ? "bg-amber-200 text-amber-950"
                    : "bg-emerald-200 text-emerald-950"
                }`}
              >
                {lastAddStatus.publishedStatus === "draft"
                  ? "下書き"
                  : "公開済み"}
              </span>
            </div>
          ) : null}
        </div>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted">
            まず「作品を探す」で未掲載作品を取得してください。
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="font-medium">
                候補 {candidates.length} 件 / 選択 {selected.size} 件
              </p>
              <button
                type="button"
                className="text-sky-700 underline"
                onClick={() =>
                  setSelected(new Set(candidates.map((c) => c.contentId)))
                }
              >
                すべて選択
              </button>
            </div>
            <ul className="space-y-3">
              {candidates.map((c) => {
                const id = c.contentId;
                const checked = selected.has(id);
                const image = getDmmItemImageUrl(c.item);
                const actresses = getDmmItemActressNameList(c.item).slice(0, 3).join("、");
                const maker = getDmmItemMakerName(c.item) ?? "—";
                const price = formatDmmItemPrice(c.item) || "—";
                const open = expandedCandidate === id;
                return (
                  <li
                    key={id}
                    className="rounded-2xl border border-border bg-white p-3"
                  >
                    <div className="flex gap-3">
                      <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                        {image ? (
                          <Image
                            src={image}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="64px"
                            unoptimized
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <label className="flex cursor-pointer items-start gap-2">
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
                          <span className="text-sm font-semibold leading-snug">
                            {c.item.title || id}
                          </span>
                        </label>
                        <p className="mt-1 text-xs text-muted">CID: {id}</p>
                        <p className="mt-1 text-xs text-muted line-clamp-1">
                          {actresses || "女優情報なし"} / {maker}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {c.item.date || "発売日—"} / {price}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="min-h-[40px] rounded-lg border border-border px-3 text-xs font-medium"
                        onClick={() =>
                          setExpandedCandidate((prev) => (prev === id ? null : id))
                        }
                      >
                        {open ? "詳細を閉じる" : "詳細を見る"}
                      </button>
                      <a
                        href={`/works/${id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[40px] items-center rounded-lg border border-border px-3 text-xs font-medium"
                      >
                        作品を見る
                      </a>
                      <button
                        type="button"
                        className="min-h-[40px] rounded-lg border border-border px-3 text-xs font-medium"
                        onClick={() => {
                          void navigator.clipboard?.writeText(
                            JSON.stringify(c.item, null, 2),
                          );
                          setMessage("JSONをクリップボードにコピーしました");
                        }}
                      >
                        JSON確認
                      </button>
                      <button
                        type="button"
                        className="min-h-[40px] rounded-lg bg-sky-600 px-3 text-xs font-bold text-white"
                        onClick={() =>
                          setSelected((prev) => new Set(prev).add(id))
                        }
                      >
                        追加対象に選択
                      </button>
                    </div>
                    {open ? (
                      <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-zinc-50 p-2 text-[11px]">
                        {JSON.stringify(
                          {
                            contentId: id,
                            productId: c.productId,
                            rankPosition: c.rankPosition,
                            item: c.item,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardShell>

      {/* ③ 掲載作品を更新 */}
      <CardShell
        id="works-ops-step-3"
        step="③"
        title="掲載作品を更新する"
        tone={activeStep === 3 ? "info" : "default"}
      >
        <p className="mb-3 text-sm text-muted">
          価格・セール・評価・販売状況をDBへ直接更新します。デプロイは発生しません。
        </p>

        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
          <p className="font-bold">データ保存先: {liveStorage?.label ?? "読込中…"}</p>
          <p className="mt-1 text-xs">
            同期対象{" "}
            {syncTargetLimit != null
              ? `${syncTargetLimit.toLocaleString()}件（上限）`
              : "全掲載作品"}
            {" / "}
            DB件数 {(liveStorage?.rowCount ?? 0).toLocaleString()}件
          </p>
          <p className="mt-2 text-xs">
            取得件数 {liveMetrics?.requestedCount ?? "—"}
            {" / "}
            DB取得時間{" "}
            {liveMetrics?.dbFetchMs != null
              ? `${liveMetrics.dbFetchMs}ms`
              : "—"}
            {" / "}
            JSONフォールバック {liveMetrics?.jsonFallbackCount ?? "—"}
            {" / "}
            キャッシュHit率{" "}
            {liveMetrics?.cacheHitRate != null
              ? `${Math.round(liveMetrics.cacheHitRate * 100)}%`
              : "—"}
            {" / "}
            応答時間{" "}
            {liveMetrics?.totalMs != null ? `${liveMetrics.totalMs}ms` : "—"}
          </p>
          <p className="mt-1 text-xs font-medium">
            この操作では Vercel デプロイ・Git commit・カタログJSON書き換えは行いません。
          </p>
        </div>

        <div
          className={`mb-4 rounded-xl border px-3 py-3 text-sm ${
            lightSyncStatus === "enabled"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : lightSyncStatus === "disabled"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-zinc-300 bg-zinc-50 text-zinc-800"
          }`}
        >
          <p className="font-bold">軽量同期: {statusLabel(lightSyncStatus)}</p>
          {lightSyncStatus !== "enabled" ? (
            <Link
              href="/admin/settings"
              className="mt-2 inline-flex min-h-[40px] items-center font-bold underline"
            >
              設定画面へ
            </Link>
          ) : null}
        </div>

        <div className="space-y-2">
          {(
            [
              ["price", "価格・セールのみ"],
              ["date", "新着順を更新"],
              ["rank", "人気順を更新"],
              ["date_rank", "新着＋人気"],
              ["light", "軽量項目すべて"],
            ] as const
          ).map(([mode, label]) => (
            <label
              key={mode}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm"
            >
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
          className="mt-4 min-h-[52px] w-full rounded-xl bg-sky-600 font-bold text-white disabled:opacity-50"
        >
          {syncRunning && syncJob?.mode !== "full"
            ? `更新中… ${syncJob?.processedCount ?? 0} / ${syncJob?.targetCount ?? 0}`
            : "掲載作品を最新に更新"}
        </button>

        {syncJob &&
        (syncJob.status === "failed" || syncJob.status === "partial_failed") &&
        syncJob.processedCount < syncJob.targetCount ? (
          <button
            type="button"
            disabled={!configured || !dmmConfigured || syncStarting || syncRunning}
            onClick={() => void handleResumeSync()}
            className="mt-3 min-h-[48px] w-full rounded-xl border border-sky-600 bg-white font-bold text-sky-700 disabled:opacity-50"
          >
            途中再開
          </button>
        ) : null}

        {syncRunning ? (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-sky-100">
              <div
                className="h-full bg-sky-600 transition-all"
                style={{ width: `${Math.min(100, syncProgress)}%` }}
              />
            </div>
            <p className="mt-2 text-sm">
              総対象 {syncJob?.targetCount ?? 0}
              {" / "}取得済み {syncJob?.processedCount ?? 0}
              {" / "}DB更新 {syncJob?.updatedCount ?? 0}
              {" / "}変更なし {syncJob?.unchangedCount ?? 0}
              {" / "}未一致 {syncJob?.unconfirmedCount ?? 0}
              {" / "}エラー {syncJob?.errorCount ?? 0}
            </p>
            {syncJob?.startedAt ? (
              <p className="mt-1 text-xs text-muted">
                実行時間:{" "}
                {formatDuration(
                  Date.now() - Date.parse(syncJob.startedAt),
                )}
              </p>
            ) : null}
            {syncJob?.message ? (
              <p className="mt-1 text-xs text-muted">{syncJob.message}</p>
            ) : null}
          </div>
        ) : null}

        {syncJob?.status === "failed" && syncJob.message ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <p className="font-bold">エラー</p>
            <p className="mt-1">{syncJob.message}</p>
          </div>
        ) : null}

        {syncHistory[0] ? (
          <div className="mt-4 rounded-xl bg-white/80 p-3 text-sm">
            <p className="font-bold">直近の同期結果</p>
            <p className="mt-1 text-muted">
              更新 {syncHistory[0].updatedCount} / 未一致{" "}
              {syncHistory[0].unconfirmedCount} / エラー{" "}
              {syncHistory[0].errorCount} / 対象{" "}
              {syncHistory[0].targetCount}
            </p>
            <p className="mt-1 text-xs text-muted">
              最終成功: {formatDateTime(syncHistory[0].completedAt)}
            </p>
          </div>
        ) : null}

        {fullSyncEnabled ? (
          <button
            type="button"
            disabled={!configured || !dmmConfigured || syncStarting || syncRunning}
            onClick={() => void handleStartSync("full")}
            className="mt-4 min-h-[44px] w-full rounded-xl border border-border bg-white text-sm font-medium disabled:opacity-50"
          >
            完全同期（作業ブランチへ書き込み・デプロイなし）
          </button>
        ) : null}
      </CardShell>

      {/* ④ 本番へ反映（作品追加では不要） */}
      <CardShell
        id="works-ops-step-4"
        step="④"
        title="本番反映について"
        tone="default"
      >
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
          <p className="font-bold">作品追加・価格同期は本番反映不要です</p>
          <p className="mt-1 text-xs">
            新規作品は Supabase（works）へ直接保存され、公開ページは revalidateTag
            のみで反映されます。Git差分・commit・push・Vercelデプロイは発生しません。
          </p>
          <p className="mt-2 text-xs">
            価格・セール同期も DB（work_live_status）直接更新です。下の「本番反映」は旧カタログJSON運用の残機能で、通常の作品追加では使いません。
          </p>
        </div>

        <details className="mt-4 rounded-xl border border-border bg-white p-3">
          <summary className="cursor-pointer text-sm font-bold text-muted">
            旧：Gitカタログの本番反映（通常不要）
          </summary>
          <p className="mt-2 text-sm text-muted">
            作業ブランチのカタログJSONを main へ反映し Production デプロイする旧フローです。Supabase
            作品マスター運用では原則使いません。
          </p>

        {(promoteStatus?.productionAheadCount ?? 0) > 0 ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            本番側に新しい変更があります。先に「作業ブランチを最新化」してください。
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={!githubConfigured || syncingWorking || promoting}
            onClick={() => void handleSyncWorking()}
            className="min-h-[52px] w-full rounded-xl border border-sky-600 bg-white font-bold text-sky-800 disabled:opacity-50"
          >
            {syncingWorking ? "最新化中…" : "作業ブランチを最新化"}
          </button>
          <button
            type="button"
            disabled={!canPromote}
            onClick={() => setPromoteConfirm(true)}
            className="min-h-[52px] w-full rounded-xl bg-sky-600 font-bold text-white disabled:opacity-40"
          >
            {promoting ? "反映中…" : "検証して本番反映（旧フロー）"}
          </button>
        </div>


        {showConflict ? (
          <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-bold">競合のため停止しました（自動上書きしません）</p>
            <p className="mt-1">
              作業内容を最新状態へ合わせる必要があります。内容を確認するか、破棄して本番に合わせてください。
            </p>
            <button
              type="button"
              onClick={() => setShowTechDetail(true)}
              className="mt-2 text-xs underline"
            >
              技術詳細（HTTP409 等）を表示
            </button>
            <button
              type="button"
              disabled={promoting}
              onClick={async () => {
                const confirmText = "未反映の変更を破棄";
                const response = await fetch(
                  "/api/admin/import/promote/discard",
                  {
                    method: "POST",
                    cache: "no-store",
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

        {promoteConfirm ? (
          <div className="mt-4 rounded-xl border border-border bg-white p-4 text-sm">
            <p className="font-bold">検証して本番反映しますか？</p>
            <ul className="mt-2 space-y-1 text-muted">
              <li>追加作品：{(promoteStatus?.addedWorkCount ?? 0).toLocaleString()}件</li>
              <li>更新作品：{(promoteStatus?.updatedWorkCount ?? 0).toLocaleString()}件</li>
              <li>デプロイ：Production 1回のみ</li>
            </ul>
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
        </details>
      </CardShell>

      {/* ログ */}
      <CardShell step="ログ" title="実行ログ">
        {logs.length === 0 && syncHistory.length === 0 ? (
          <p className="text-sm text-muted">まだ実行履歴はありません。</p>
        ) : (
          <>
            <ul className="space-y-2">
              {visibleLogs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {log.ok ? "成功" : "失敗"} · {log.action}
                    </span>
                    <span className="text-xs text-muted">
                      {formatDuration(log.durationMs)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {log.message} · {formatDateTime(log.at)}
                  </p>
                  {log.detail ? (
                    <button
                      type="button"
                      className="mt-1 text-xs text-sky-700 underline"
                      onClick={() =>
                        setExpandedLogId((prev) =>
                          prev === log.id ? null : log.id,
                        )
                      }
                    >
                      詳細ログ
                    </button>
                  ) : null}
                  {expandedLogId === log.id && log.detail ? (
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-zinc-50 p-2 text-[11px]">
                      {log.detail}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
            {logs.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllLogs((v) => !v)}
                className="mt-3 text-sm font-medium text-sky-700 underline"
              >
                {showAllLogs ? "直近だけ表示" : "すべて見る"}
              </button>
            ) : null}
          </>
        )}
      </CardShell>

      {/* スマホ固定バー */}
      {candidates.length > 0 ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden"
          style={{
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="mx-auto flex max-w-lg items-center gap-2">
            <p className="min-w-0 flex-1 text-sm font-bold">
              選択中 {selected.size} 件
            </p>
            <button
              type="button"
              className="min-h-[44px] rounded-xl border border-border px-3 text-sm"
              onClick={() => setSelected(new Set())}
            >
              解除
            </button>
            <button
              type="button"
              disabled={adding || selected.size === 0}
              title={
                selected.size === 0
                  ? "作品を1件以上選択してください"
                  : "選択中の作品を作品マスター（Supabase）へ追加"
              }
              onClick={() => void handleAddSelected()}
              className="min-h-[44px] rounded-xl bg-sky-600 px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              {adding ? "追加中…" : "追加する"}
            </button>
          </div>
          {selected.size === 0 ? (
            <p className="mt-1 text-center text-[11px] text-muted">
              追加するには作品を選択してください
            </p>
          ) : null}
        </div>
      ) : null}

      {/* PC用追加バー */}
      {candidates.length > 0 ? (
        <div className="hidden rounded-2xl border border-border bg-white p-3 sm:block">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold">選択中 {selected.size} 件</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-[44px] rounded-xl border border-border px-4 text-sm"
                onClick={() => setSelected(new Set())}
              >
                選択を解除
              </button>
              <button
                type="button"
                disabled={adding || selected.size === 0}
                title={
                  selected.size === 0
                    ? "作品を1件以上選択してください"
                    : undefined
                }
                onClick={() => void handleAddSelected()}
                className="min-h-[44px] rounded-xl bg-sky-600 px-5 text-sm font-bold text-white disabled:opacity-40"
              >
                {adding ? "追加中…" : "追加する"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
