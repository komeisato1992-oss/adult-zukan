"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { WorksCmsAddTab } from "@/components/admin/works-cms/AddTab";
import { WorksCmsFanzaTvTab } from "@/components/admin/works-cms/FanzaTvTab";
import { WorksCmsHistoryTab } from "@/components/admin/works-cms/HistoryTab";
import { WorksCmsOverviewPanel } from "@/components/admin/works-cms/OverviewPanel";
import {
  WorksCmsPublishTab,
  type PublishFilters,
} from "@/components/admin/works-cms/PublishTab";
import { WorksCmsSyncTab } from "@/components/admin/works-cms/SyncTab";
import { WorksCmsTabNav } from "@/components/admin/works-cms/TabNav";
import {
  FETCH_COUNTS,
  type AddStep,
  type AdultImportSortMode,
  type AdultSyncMode,
  type CmsListItem,
  type FanzaTvCheckJobView,
  type FanzaTvCheckStatsView,
  type FetchedImportCandidate,
  type FetchImportCandidatesSummary,
  type LiveInitJob,
  type SyncHistoryEntry,
  type SyncJob,
  type SyncProgressState,
  type SyncStatusPayload,
  type SyncTargetScope,
  type WorksCmsTabId,
} from "@/components/admin/works-cms/types";
import { buildAddSelectedWorksPayload } from "@/lib/admin/import-add-payload";
import {
  buildWorksCmsListSearchParams,
  fetchAllFilteredWorksCmsCids,
} from "@/lib/admin/works-cms-list-params";
import {
  refreshWorksCmsOverview,
  useWorksCmsOverview,
} from "@/lib/admin/works-cms-overview-client";

/** 公開タブ・スマホ固定バーのフォールバック高さ（計測前） */
const PUBLISH_MOBILE_BAR_FALLBACK_PX = 220;
const ADD_MOBILE_BAR_FALLBACK_PX = 140;

const DEFAULT_FILTERS: PublishFilters = {
  cid: "",
  title: "",
  actress: "",
  maker: "",
  label: "",
  series: "",
  genre: "",
  status: "all",
};

export function AdminWorksCms() {
  const [tab, setTab] = useState<WorksCmsTabId>("add");
  const { data: overview = null } = useWorksCmsOverview();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // add
  const [sort, setSort] = useState<AdultImportSortMode>("new");
  const [fetchCount, setFetchCount] =
    useState<(typeof FETCH_COUNTS)[number]>(50);
  const [offset, setOffset] = useState(0);
  const [candidates, setCandidates] = useState<FetchedImportCandidate[]>([]);
  const [summary, setSummary] = useState<FetchImportCandidatesSummary | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cidInput, setCidInput] = useState("");

  // sync
  const [syncJob, setSyncJob] = useState<SyncJob | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [canStartLightSync, setCanStartLightSync] = useState(false);
  const [disableReasons, setDisableReasons] = useState<string[]>([]);
  const [syncTargetCount, setSyncTargetCount] = useState(0);
  const [uncheckedCount, setUncheckedCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState<SyncProgressState | null>(
    null,
  );
  const [liveInitJob, setLiveInitJob] = useState<LiveInitJob | null>(null);
  const [lastSuccessByMode, setLastSuccessByMode] = useState<
    Partial<Record<AdultSyncMode, string | null>>
  >({});
  const liveInitProcessingRef = useRef(false);

  // publish
  const [items, setItems] = useState<CmsListItem[]>([]);
  const [filters, setFilters] = useState<PublishFilters>(DEFAULT_FILTERS);
  const [pubSelected, setPubSelected] = useState<Set<string>>(new Set());
  const [pubSelectAllBusy, setPubSelectAllBusy] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);
  const bottomBarRef = useRef<HTMLDivElement | null>(null);
  const [editCid, setEditCid] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [unpublishNoImageResult, setUnpublishNoImageResult] = useState<
    string | null
  >(null);

  // fanza tv check
  const [fanzaTvJob, setFanzaTvJob] = useState<FanzaTvCheckJobView | null>(
    null,
  );
  const [fanzaTvStats, setFanzaTvStats] =
    useState<FanzaTvCheckStatsView | null>(null);
  const [fanzaTvProfileReady, setFanzaTvProfileReady] = useState(false);
  const [fanzaTvProfileMessage, setFanzaTvProfileMessage] = useState<
    string | null
  >(null);
  const [fanzaTvCanRunPlaywright, setFanzaTvCanRunPlaywright] =
    useState(false);

  const refreshSync = useCallback(async () => {
    const res = await fetch("/api/admin/fanza-sync/status", {
      cache: "no-store",
    });
    const data = (await res.json()) as SyncStatusPayload;
    if (!data.success) return;
    setSyncJob(data.currentJob);
    setSyncHistory(data.history ?? []);
    setCanStartLightSync(Boolean(data.canStartLightSync));
    setDisableReasons(data.disableReasons ?? []);
    setSyncTargetCount(data.syncTargetCount ?? 0);
    setUncheckedCount(data.uncheckedCount ?? data.counts?.uncheckedImageStatus ?? 0);
    setSyncProgress(data.syncProgress ?? null);
    if (data.liveStatusInit?.currentJob) {
      setLiveInitJob(data.liveStatusInit.currentJob);
    }
    const byMode: Partial<Record<AdultSyncMode, string | null>> = {};
    for (const h of data.history ?? []) {
      const mode = (h.mode || "light") as AdultSyncMode;
      if (h.status === "completed" && h.completedAt) {
        if (!byMode[mode] || (byMode[mode] ?? "") < h.completedAt) {
          byMode[mode] = h.completedAt;
        }
      }
    }
    if (data.currentJob?.status === "completed" && data.currentJob.completedAt) {
      const mode = (data.currentJob.mode || "light") as AdultSyncMode;
      byMode[mode] = data.currentJob.completedAt;
    }
    setLastSuccessByMode(byMode);
  }, []);

  const refreshFanzaTv = useCallback(async () => {
    const res = await fetch("/api/admin/fanza-tv-check/status", {
      cache: "no-store",
    });
    const data = await res.json();
    if (!data.success) return;
    setFanzaTvJob(data.currentJob ?? null);
    setFanzaTvStats(data.stats ?? null);
    setFanzaTvProfileReady(Boolean(data.profileReady));
    setFanzaTvProfileMessage(data.profileMessage ?? null);
    setFanzaTvCanRunPlaywright(
      data.canRunPlaywright === true || data.localOnly === true,
    );
  }, []);

  const refreshList = useCallback(async () => {
    const params = buildWorksCmsListSearchParams(filters, 1, 40);
    const res = await fetch(`/api/admin/works-cms/list?${params}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (data.success) setItems(data.items ?? []);
  }, [filters]);

  const handlePubSelectAll = useCallback(async () => {
    setPubSelectAllBusy(true);
    try {
      const cids = await fetchAllFilteredWorksCmsCids(filters);
      setPubSelected(new Set(cids));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPubSelectAllBusy(false);
    }
  }, [filters]);

  const handlePubClearSelection = useCallback(() => {
    setPubSelected(new Set());
  }, []);

  useEffect(() => {
    void refreshSync();
    void refreshFanzaTv();
  }, [refreshSync, refreshFanzaTv]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (tab === "publish") void refreshList();
  }, [tab, refreshList]);

  useEffect(() => {
    if (tab === "fanza-tv") void refreshFanzaTv();
  }, [tab, refreshFanzaTv]);

  useEffect(() => {
    const running =
      fanzaTvJob?.status === "running" || fanzaTvJob?.status === "pending";
    if (!running && tab !== "fanza-tv") return;
    const id = window.setInterval(() => {
      void refreshFanzaTv();
    }, 2000);
    return () => window.clearInterval(id);
  }, [fanzaTvJob?.status, tab, refreshFanzaTv]);

  // 見放題判定の完了時のみ運用状況を再取得（ポーリング中は再取得しない）
  const prevFanzaTvStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevFanzaTvStatusRef.current;
    const cur = fanzaTvJob?.status ?? null;
    prevFanzaTvStatusRef.current = cur;
    if (
      prev &&
      (prev === "running" || prev === "pending") &&
      cur &&
      cur !== "running" &&
      cur !== "pending"
    ) {
      void refreshWorksCmsOverview();
    }
  }, [fanzaTvJob?.status]);

  useEffect(() => {
    if (overview?.offsets?.bySort) {
      const key = sort === "popular" ? "popular" : "new";
      setOffset(overview.offsets.bySort[key]?.lastOffset ?? 0);
    }
  }, [overview, sort]);

  const addStep: AddStep = useMemo(() => {
    if (selected.size > 0) return 4;
    if (candidates.length > 0) return 3;
    if (summary) return 2;
    return 1;
  }, [selected.size, candidates.length, summary]);

  const fanzaReady =
    (overview?.fanzaTv.uncheckedCount ?? 0) +
      (overview?.fanzaTv.activeCount ?? 0) +
      (overview?.fanzaTv.notAvailableCount ?? 0) +
      (overview?.fanzaTv.unknownCount ?? 0) >
    0;

  const selectOkCandidates = (list: FetchedImportCandidate[]) =>
    new Set(
      list
        .filter((c) => c.imageStatus === "ok" && !c.imageUrlMissing)
        .map((c) => c.contentId),
    );

  const handleFetch = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/import/fetch-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sort,
          startOffset: offset,
          requestedCount: fetchCount,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "候補取得に失敗しました");
      }
      const nextCandidates = (data.candidates ??
        []) as FetchedImportCandidate[];
      setCandidates(nextCandidates);
      setSummary(data.summary ?? null);
      // 画像あり（ok）のみ初期選択
      setSelected(selectOkCandidates(nextCandidates));
      if (typeof data.summary?.nextOffset === "number") {
        setOffset(data.summary.nextOffset);
      }
      const ok = data.summary?.imageOkCount ?? selectOkCandidates(nextCandidates).size;
      const np = data.summary?.imageNowPrintingCount ?? 0;
      const ff = data.summary?.imageFetchFailedCount ?? 0;
      const nu = data.summary?.imageNoUrlCount ?? 0;
      setMessage(
        [
          `候補 ${data.summary?.candidateCount ?? nextCandidates.length}件`,
          `画像あり ${ok} / NOW PRINTING ${np} / 確認失敗 ${ff} / URLなし ${nu}`,
          data.summary?.imageCheckMessage || null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
      await refreshWorksCmsOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleRecheckFailedImages = async () => {
    const targets = candidates.filter(
      (c) => c.imageStatus === "fetch_failed" && !c.imageUrlMissing,
    );
    if (targets.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/import/recheck-candidate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates: targets }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "画像の再確認に失敗しました");
      }
      const updated = (data.candidates ?? []) as FetchedImportCandidate[];
      const byId = new Map(updated.map((c) => [c.contentId, c]));
      const nextCandidates = candidates.map((c) => byId.get(c.contentId) ?? c);
      setCandidates(nextCandidates);

      // 正常画像になった作品は自動選択ON、NOW PRINTING は OFF のまま
      setSelected((prev) => {
        const next = new Set(prev);
        for (const c of updated) {
          if (c.imageStatus === "ok" && !c.imageUrlMissing) {
            next.add(c.contentId);
          } else if (c.imageStatus === "now_printing" || c.imageUrlMissing) {
            next.delete(c.contentId);
          }
        }
        return next;
      });

      setSummary((prev) =>
        prev
          ? {
              ...prev,
              imageOkCount: nextCandidates.filter(
                (c) => c.imageStatus === "ok" && !c.imageUrlMissing,
              ).length,
              imageNowPrintingCount: nextCandidates.filter(
                (c) => c.imageStatus === "now_printing",
              ).length,
              imageFetchFailedCount: nextCandidates.filter(
                (c) =>
                  c.imageStatus === "fetch_failed" && !c.imageUrlMissing,
              ).length,
              imageNoUrlCount: nextCandidates.filter((c) => c.imageUrlMissing)
                .length,
              imageCheckMessage: data.stats?.message ?? prev.imageCheckMessage,
            }
          : prev,
      );
      setMessage(data.stats?.message || "画像の再確認が完了しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleAddSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const picked = candidates.filter((c) => selected.has(c.contentId));
      const payload = buildAddSelectedWorksPayload(picked);
      const res = await fetch("/api/admin/import/add-selected-works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || data.message || "追加に失敗");
      }
      setMessage(
        data.message ||
          `${data.summary?.addedCount ?? 0}件をSupabaseへ追加しました（デプロイなし）`,
      );
      setSelected(new Set());
      await refreshWorksCmsOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleAddByCid = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/works-cms/add-by-cid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cids: cidInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "CID追加に失敗");
      }
      setMessage(
        `CID追加: ${data.addedCount}件（重複 ${data.duplicateCount}）・デプロイなし`,
      );
      setCidInput("");
      await refreshWorksCmsOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const runSyncLoop = async () => {
    for (;;) {
      const res = await fetch("/api/admin/fanza-sync/process", {
        method: "POST",
      });
      const data = await res.json();
      if (data.currentJob) setSyncJob(data.currentJob);
      if (!data.success) throw new Error(data.error || data.message || "同期バッチ失敗");
      if (
        data.done ||
        data.job?.status === "completed" ||
        data.job?.status === "failed" ||
        data.currentJob?.status === "completed" ||
        data.currentJob?.status === "failed"
      ) {
        break;
      }
      if (data.job?.status === "stopped" || data.stopped) break;
    }
    await refreshWorksCmsOverview();
    await refreshSync();
  };

  const handleStartSync = async (input: {
    mode: AdultSyncMode;
    limit: number;
    targetScope: SyncTargetScope;
    startOffset: number;
  }) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/fanza-sync/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: input.mode,
          trigger: "manual",
          limit: input.limit,
          targetScope:
            input.targetScope === "unchecked" ? "unchecked" : "all",
          startOffset: input.startOffset,
        }),
      });
      const data = await res.json();
      if (data.alreadyRunning) {
        throw new Error(data.message || "現在、更新処理を実行中です");
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "同期開始に失敗");
      }
      setSyncJob(data.job ?? data.currentJob);
      await runSyncLoop();
      setMessage("掲載情報の更新が完了しました（Supabaseのみ・デプロイなし）");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleResumeSync = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/fanza-sync/resume", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "再開に失敗");
      }
      await runSyncLoop();
      setMessage("同期を再開して完了しました（デプロイなし）");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const processLiveInitBatch = useCallback(async () => {
    if (liveInitProcessingRef.current) return null;
    liveInitProcessingRef.current = true;
    try {
      const res = await fetch(
        "/api/admin/fanza-sync/init-live-status/process",
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();
      if (data.job) setLiveInitJob(data.job);
      if (!res.ok || data.ok === false || data.success === false) {
        throw new Error(data.message || "初期化バッチ失敗");
      }
      return data as { done?: boolean; job?: LiveInitJob; message?: string };
    } finally {
      liveInitProcessingRef.current = false;
    }
  }, []);

  const handleStartLiveInit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/fanza-sync/init-live-status", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false || data.success === false) {
        throw new Error(data.message || "初期化開始に失敗");
      }
      if (data.currentJob) setLiveInitJob(data.currentJob);
      setMessage(data.message ?? "変動情報の初期化を開始しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleStopLiveInit = async () => {
    const res = await fetch("/api/admin/fanza-sync/init-live-status/stop", {
      method: "POST",
      cache: "no-store",
    });
    const data = await res.json();
    if (data.currentJob) setLiveInitJob(data.currentJob);
    setMessage(data.message ?? "初期化を停止しました");
  };

  const handleResumeLiveInit = async () => {
    const res = await fetch("/api/admin/fanza-sync/init-live-status/resume", {
      method: "POST",
      cache: "no-store",
    });
    const data = await res.json();
    if (data.currentJob) setLiveInitJob(data.currentJob);
    setMessage(data.message ?? "初期化を再開しました");
  };

  const handleStartFanzaTv = async (
    mode: "unchecked_only" | "full_recheck" | "limit",
    limit?: 100 | 500 | 1000 | "all",
  ) => {
    if (!fanzaTvCanRunPlaywright) {
      setMessage(
        "見放題判定はMac上で実行します。本番管理画面では結果と進捗のみ確認できます。",
      );
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/fanza-tv-check/start", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, limit: limit ?? null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "見放題判定の開始に失敗しました");
      }
      setFanzaTvJob(data.currentJob ?? null);
      setMessage(
        data.message ??
          "見放題判定を開始しました（Mac上でPlaywrightが動作・デプロイなし）",
      );
      await refreshFanzaTv();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleStopFanzaTv = async () => {
    if (!fanzaTvCanRunPlaywright) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/fanza-tv-check/stop", {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "停止に失敗しました");
      }
      setFanzaTvJob(data.currentJob ?? null);
      setMessage(data.message ?? "見放題判定を停止しました");
      await refreshFanzaTv();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleResumeFanzaTv = async () => {
    if (!fanzaTvCanRunPlaywright) {
      setMessage(
        "見放題判定はMac上で実行します。本番管理画面では結果と進捗のみ確認できます。",
      );
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/fanza-tv-check/resume", {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "再開に失敗しました");
      }
      setFanzaTvJob(data.currentJob ?? null);
      setMessage(data.message ?? "見放題判定を再開しました");
      await refreshFanzaTv();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (
      !liveInitJob ||
      (liveInitJob.status !== "running" &&
        liveInitJob.status !== "pending" &&
        liveInitJob.status !== "waiting")
    ) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      if (liveInitJob.status === "waiting" && liveInitJob.waitUntil) {
        const waitMs = Date.parse(liveInitJob.waitUntil) - Date.now();
        if (waitMs > 0) {
          await new Promise((r) =>
            setTimeout(r, Math.min(waitMs + 50, 20_000)),
          );
        }
      }
      if (cancelled) return;
      try {
        const result = await processLiveInitBatch();
        if (result?.done) {
          setMessage(result.job?.message ?? "変動情報の初期化が完了しました");
          await refreshSync();
          await refreshWorksCmsOverview();
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [liveInitJob, processLiveInitBatch, refreshSync]);

  const handleUnpublishNoImage = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "画像なし作品を一括で非公開にします。よろしいですか？（デプロイなし）",
      )
    ) {
      return;
    }
    setBusy(true);
    setUnpublishNoImageResult(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/works-cms/unpublish-no-image", {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "一括非公開に失敗しました");
      }
      const msg =
        data.message ||
        `画像なし ${data.noImageCount}件中 ${data.unpublishedCount}件を非公開化（デプロイなし）`;
      setUnpublishNoImageResult(msg);
      setMessage(msg);
      await refreshWorksCmsOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const mutatePublish = async (
    action: string,
    cids: string[],
    extra?: Record<string, unknown>,
  ) => {
    if (cids.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/works-cms/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "publish", action, cids, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "更新に失敗");
      }
      const skipped = Array.isArray(data.skipped) ? data.skipped : [];
      const skipMsg =
        skipped.length > 0
          ? ` / スキップ ${skipped.length}件（${skipped[0]?.reason ?? ""}）`
          : "";
      setMessage(
        `${action}: ${data.updated}件更新${skipMsg}（デプロイなし）`,
      );
      setPubSelected(new Set());
      await refreshList();
      await refreshWorksCmsOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editCid) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/works-cms/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "edit",
          cid: editCid,
          patch: { title: editTitle },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "編集失敗");
      setEditCid(null);
      setMessage("作品を更新しました（Supabaseのみ）");
      await refreshList();
      await refreshWorksCmsOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const selectedCount = selected.size;
  const pubSelectedCount = pubSelected.size;
  const showBottomBar = tab === "add" || tab === "publish";
  const fallbackBarPx =
    tab === "publish"
      ? PUBLISH_MOBILE_BAR_FALLBACK_PX
      : ADD_MOBILE_BAR_FALLBACK_PX;
  const contentPadBottom = showBottomBar
    ? Math.max(bottomBarHeight, fallbackBarPx)
    : 0;

  useLayoutEffect(() => {
    if (!showBottomBar || !portalReady) {
      setBottomBarHeight(0);
      return;
    }
    const el = bottomBarRef.current;
    if (!el) return;

    const update = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) setBottomBarHeight(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [
    showBottomBar,
    portalReady,
    tab,
    selectedCount,
    pubSelectedCount,
    pubSelectAllBusy,
  ]);

  const bottomBar =
    showBottomBar && portalReady
      ? createPortal(
          // wrapper は画面下端に置くが透明領域のタップは透過させる
          <div
            data-works-cms-bottom-bar-root
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000] sm:hidden"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              width: "100%",
              maxWidth: "none",
              zIndex: 1000,
              // 高さは中身に合わせる（画面全体に伸ばさない）
              height: "auto",
              top: "auto",
            }}
          >
            <div
              ref={bottomBarRef}
              data-works-cms-bottom-bar
              className="pointer-events-auto border-t border-border bg-white px-3 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
              style={{
                paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
              }}
            >
              <div className="mx-auto flex w-full max-w-none flex-col gap-1.5">
                {tab === "add" ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold">
                        選択中 {selectedCount} 件
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold"
                          onClick={() =>
                            setSelected(selectOkCandidates(candidates))
                          }
                          disabled={candidates.length === 0}
                        >
                          すべて選択
                        </button>
                        <button
                          type="button"
                          className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold"
                          onClick={() =>
                            setSelected(selectOkCandidates(candidates))
                          }
                          disabled={candidates.length === 0}
                        >
                          画像ありだけ選択
                        </button>
                        <button
                          type="button"
                          className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold"
                          onClick={() => setSelected(new Set())}
                          disabled={selectedCount === 0}
                        >
                          選択解除
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy || selectedCount === 0}
                      onClick={() => void handleAddSelected()}
                      className="min-h-[44px] w-full rounded-xl bg-sky-600 text-sm font-bold text-white disabled:bg-zinc-300 disabled:text-zinc-600"
                    >
                      Supabaseへ追加
                    </button>
                    {selectedCount === 0 ? (
                      <p className="text-[11px] text-amber-800">
                        作品を1件以上選択すると追加できます
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold">
                        選択中 {pubSelectedCount} 件
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold disabled:opacity-40"
                          onClick={() => void handlePubSelectAll()}
                          disabled={
                            busy || pubSelectAllBusy || items.length === 0
                          }
                        >
                          {pubSelectAllBusy ? "選択中…" : "すべて選択"}
                        </button>
                        <button
                          type="button"
                          className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold disabled:opacity-40"
                          onClick={handlePubClearSelection}
                          disabled={busy || pubSelectedCount === 0}
                        >
                          選択解除
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={busy || pubSelectedCount === 0}
                        onClick={() =>
                          void mutatePublish("publish", [...pubSelected])
                        }
                        className="min-h-[40px] rounded-lg bg-sky-600 text-xs font-bold text-white disabled:opacity-40"
                      >
                        一括公開
                      </button>
                      <button
                        type="button"
                        disabled={busy || pubSelectedCount === 0}
                        onClick={() =>
                          void mutatePublish("unpublish", [...pubSelected])
                        }
                        className="min-h-[40px] rounded-lg border text-xs font-bold disabled:opacity-40"
                      >
                        一括非公開
                      </button>
                      <button
                        type="button"
                        disabled={busy || pubSelectedCount === 0}
                        onClick={() =>
                          void mutatePublish("mark_unavailable", [
                            ...pubSelected,
                          ])
                        }
                        className="min-h-[40px] rounded-lg border text-xs font-bold disabled:opacity-40"
                      >
                        一括販売終了
                      </button>
                      <button
                        type="button"
                        disabled={busy || pubSelectedCount === 0}
                        onClick={() => {
                          if (
                            typeof window !== "undefined" &&
                            window.confirm("選択作品を論理削除しますか？")
                          ) {
                            void mutatePublish("soft_delete", [
                              ...pubSelected,
                            ]);
                          }
                        }}
                        className="min-h-[40px] rounded-lg border border-red-400 text-xs font-bold text-red-700 disabled:opacity-40"
                      >
                        一括削除
                      </button>
                    </div>
                    {pubSelectedCount === 0 ? (
                      <p className="text-[11px] text-amber-800">
                        作品を選択すると一括操作できます
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={`space-y-3 ${
        showBottomBar
          ? "max-sm:[padding-bottom:calc(var(--cms-bottom-bar-h,220px)+env(safe-area-inset-bottom,0px))]"
          : ""
      }`}
      style={
        showBottomBar
          ? ({
              ["--cms-bottom-bar-h"]: `${contentPadBottom}px`,
            } as CSSProperties)
          : undefined
      }
    >
      <WorksCmsOverviewPanel
        overview={overview}
        onRefresh={() => {
          void refreshWorksCmsOverview();
          void refreshSync();
        }}
      />

      <WorksCmsTabNav activeTab={tab} onChange={setTab} />

      {message ? (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-xs sm:text-sm whitespace-pre-wrap">
          {message}
        </p>
      ) : null}

      {tab === "add" ? (
        <WorksCmsAddTab
          sort={sort}
          setSort={setSort}
          fetchCount={fetchCount}
          setFetchCount={setFetchCount}
          offset={offset}
          setOffset={setOffset}
          candidates={candidates}
          summary={summary}
          selected={selected}
          setSelected={setSelected}
          cidInput={cidInput}
          setCidInput={setCidInput}
          busy={busy}
          onFetch={() => void handleFetch()}
          onAddByCid={() => void handleAddByCid()}
          onRecheckFailedImages={() => void handleRecheckFailedImages()}
          step={addStep}
        />
      ) : null}

      {tab === "sync" ? (
        <WorksCmsSyncTab
          overview={overview}
          syncJob={syncJob}
          syncTargetCount={syncTargetCount}
          uncheckedCount={uncheckedCount}
          syncProgress={syncProgress}
          canStartLightSync={canStartLightSync}
          disableReasons={disableReasons}
          lastSuccessByMode={lastSuccessByMode}
          liveInitJob={liveInitJob}
          busy={busy}
          onStartSync={(input) => void handleStartSync(input)}
          onResumeSync={() => void handleResumeSync()}
          onStartLiveInit={() => void handleStartLiveInit()}
          onStopLiveInit={() => void handleStopLiveInit()}
          onResumeLiveInit={() => void handleResumeLiveInit()}
          onUnpublishNoImage={() => void handleUnpublishNoImage()}
          unpublishNoImageResult={unpublishNoImageResult}
        />
      ) : null}

      {tab === "publish" ? (
        <WorksCmsPublishTab
          items={items}
          filters={filters}
          setFilters={setFilters}
          selected={pubSelected}
          setSelected={setPubSelected}
          onSelectAllFiltered={() => void handlePubSelectAll()}
          onClearSelection={handlePubClearSelection}
          selectAllBusy={pubSelectAllBusy}
          busy={busy}
          onSearch={() => void refreshList()}
          onMutate={(action, cids, extra) =>
            void mutatePublish(action, cids, extra)
          }
          onEdit={(cid, title) => {
            setEditCid(cid);
            setEditTitle(title);
          }}
          editCid={editCid}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          onSaveEdit={() => void handleSaveEdit()}
          onCancelEdit={() => setEditCid(null)}
          fanzaReady={fanzaReady}
        />
      ) : null}

      {tab === "fanza-tv" ? (
        <WorksCmsFanzaTvTab
          overview={overview}
          job={fanzaTvJob}
          stats={fanzaTvStats}
          profileReady={fanzaTvProfileReady}
          profileMessage={fanzaTvProfileMessage}
          canRunPlaywright={fanzaTvCanRunPlaywright}
          busy={busy}
          onStart={(mode, limit) => void handleStartFanzaTv(mode, limit)}
          onStop={() => void handleStopFanzaTv()}
          onResume={() => void handleResumeFanzaTv()}
        />
      ) : null}

      {tab === "history" ? (
        <WorksCmsHistoryTab
          overview={overview}
          syncJob={syncJob}
          syncHistory={syncHistory}
          liveInitJob={liveInitJob}
          fanzaTvJob={fanzaTvJob}
          onResumeSync={() => void handleResumeSync()}
          onResumeFanzaTv={() => void handleResumeFanzaTv()}
          busy={busy}
        />
      ) : null}

      {/* PC: インライン操作バー（固定しない） */}
      {showBottomBar ? (
        <div className="mt-4 hidden rounded-xl border border-border bg-white p-3 shadow-sm sm:block">
          <div className="flex flex-col gap-2">
            {tab === "add" ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">
                    選択中 {selectedCount} 件
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold"
                      onClick={() =>
                        setSelected(selectOkCandidates(candidates))
                      }
                      disabled={candidates.length === 0}
                    >
                      すべて選択
                    </button>
                    <button
                      type="button"
                      className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold"
                      onClick={() =>
                        setSelected(selectOkCandidates(candidates))
                      }
                      disabled={candidates.length === 0}
                    >
                      画像ありだけ選択
                    </button>
                    <button
                      type="button"
                      className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold"
                      onClick={() => setSelected(new Set())}
                      disabled={selectedCount === 0}
                    >
                      選択解除
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || selectedCount === 0}
                  onClick={() => void handleAddSelected()}
                  className="min-h-[44px] w-full rounded-xl bg-sky-600 text-sm font-bold text-white disabled:bg-zinc-300 disabled:text-zinc-600 sm:w-auto sm:self-end sm:px-6"
                >
                  Supabaseへ追加
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">
                    選択中 {pubSelectedCount} 件
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold disabled:opacity-40"
                      onClick={() => void handlePubSelectAll()}
                      disabled={
                        busy || pubSelectAllBusy || items.length === 0
                      }
                    >
                      {pubSelectAllBusy ? "選択中…" : "すべて選択"}
                    </button>
                    <button
                      type="button"
                      className="min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold disabled:opacity-40"
                      onClick={handlePubClearSelection}
                      disabled={busy || pubSelectedCount === 0}
                    >
                      選択解除
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busy || pubSelectedCount === 0}
                    onClick={() =>
                      void mutatePublish("publish", [...pubSelected])
                    }
                    className="min-h-[40px] rounded-lg bg-sky-600 px-4 text-xs font-bold text-white disabled:opacity-40"
                  >
                    一括公開
                  </button>
                  <button
                    type="button"
                    disabled={busy || pubSelectedCount === 0}
                    onClick={() =>
                      void mutatePublish("unpublish", [...pubSelected])
                    }
                    className="min-h-[40px] rounded-lg border px-4 text-xs font-bold disabled:opacity-40"
                  >
                    一括非公開
                  </button>
                  <button
                    type="button"
                    disabled={busy || pubSelectedCount === 0}
                    onClick={() =>
                      void mutatePublish("mark_unavailable", [...pubSelected])
                    }
                    className="min-h-[40px] rounded-lg border px-4 text-xs font-bold disabled:opacity-40"
                  >
                    一括販売終了
                  </button>
                  <button
                    type="button"
                    disabled={busy || pubSelectedCount === 0}
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        window.confirm("選択作品を論理削除しますか？")
                      ) {
                        void mutatePublish("soft_delete", [...pubSelected]);
                      }
                    }}
                    className="min-h-[40px] rounded-lg border border-red-400 px-4 text-xs font-bold text-red-700 disabled:opacity-40"
                  >
                    一括削除
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {bottomBar}
    </div>
  );
}
