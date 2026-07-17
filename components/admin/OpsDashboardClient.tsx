"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OpsOverviewTab } from "@/components/admin/ops/OpsOverviewTab";
import { OpsSearchConsoleTab } from "@/components/admin/ops/OpsSearchConsoleTab";
import { OpsGa4Tab } from "@/components/admin/ops/OpsGa4Tab";
import { OpsDmmTab } from "@/components/admin/ops/OpsDmmTab";
import { AdminDashboardHeader } from "@/components/admin/ops/AdminDashboardHeader";
import {
  OpsRefreshProgress,
  type OpsRefreshJobView,
} from "@/components/admin/ops/OpsRefreshProgress";
import {
  opsTabHref,
  parseOpsTab,
  type OpsTabId,
} from "@/lib/admin/ops-tabs";
import {
  mergeOpsDashboardPayload,
  isOpsPayloadStaleOverall,
} from "@/lib/admin/ops-payload-merge";
import {
  OPS_REFRESH_JOB_KEYS,
  OPS_REFRESH_JOB_LABELS,
  OPS_REFRESH_TIMEOUT_MS,
  OpsRefreshTimeoutError,
  evaluateSourceRefresh,
  humanizeOpsRefreshError,
  postOpsRefresh,
  type OpsRefreshJobKey,
  type OpsRefreshJobStatus,
} from "@/lib/admin/ops-refresh-client";
import type {
  OpsDashboardPayload,
  OpsDmmPeriod,
  OpsGscPeriod,
  OpsGa4Period,
  OpsTask,
} from "@/lib/admin/ops-types";

type OpsDashboardClientProps = {
  initialData: OpsDashboardPayload;
  initialTab?: string | null;
};

type JobMap = Record<OpsRefreshJobKey, OpsRefreshJobView>;

function createIdleJobs(): JobMap {
  return {
    seo: { status: "idle", detail: "" },
    ga4: { status: "idle", detail: "" },
    dmm: { status: "idle", detail: "" },
    score: { status: "idle", detail: "" },
  };
}

function pendingDetail(key: OpsRefreshJobKey): string {
  return key === "score" ? "処理中" : "取得中";
}

export function OpsDashboardClient({
  initialData,
  initialTab,
}: OpsDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = parseOpsTab(searchParams.get("tab") ?? initialTab);
  const [activeTab, setActiveTab] = useState<OpsTabId>(tabFromUrl);
  const [data, setData] = useState(initialData);
  const [gscPeriod, setGscPeriod] = useState<OpsGscPeriod>("28");
  const [ga4Period, setGa4Period] = useState<OpsGa4Period>(28);
  const [dmmPeriod, setDmmPeriod] = useState<OpsDmmPeriod>("7d");
  const [tasks, setTasks] = useState<OpsTask[]>(initialData.tasks);
  const [message, setMessage] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobMap>(createIdleJobs);
  const [refreshStartedAt, setRefreshStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [uploadPending, startUploadTransition] = useTransition();
  const runningKeysRef = useRef<Set<OpsRefreshJobKey>>(new Set());
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    if (!refreshStartedAt) return;
    const hasPending = OPS_REFRESH_JOB_KEYS.some(
      (key) => jobs[key].status === "pending",
    );
    if (!hasPending) return;

    setElapsedMs(Date.now() - refreshStartedAt);
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - refreshStartedAt);
    }, 500);
    return () => window.clearInterval(timer);
  }, [refreshStartedAt, jobs]);

  const applyPayload = useCallback((payload: OpsDashboardPayload) => {
    setData((current) => {
      if (isOpsPayloadStaleOverall(current, payload)) {
        return current;
      }
      const merged = mergeOpsDashboardPayload(current, payload);
      setTasks(merged.tasks as OpsTask[]);
      return merged;
    });
  }, []);

  const setJobStatus = useCallback(
    (
      key: OpsRefreshJobKey,
      status: OpsRefreshJobStatus,
      detail: string,
    ) => {
      setJobs((current) => ({
        ...current,
        [key]: { status, detail },
      }));
    },
    [],
  );

  function changeTab(tab: OpsTabId) {
    setActiveTab(tab);
    const href = opsTabHref(tab);
    router.replace(href, { scroll: false });
    if (pathname !== "/admin" && !href.startsWith("/admin?")) {
      // no-op safeguard
    }
  }

  function completeTask(id: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: true } : task,
      ),
    );
  }

  function scrollToProgress() {
    progressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const anyJobPending = OPS_REFRESH_JOB_KEYS.some(
    (key) => jobs[key].status === "pending",
  );

  const refreshingLabel = useMemo(() => {
    const pending = OPS_REFRESH_JOB_KEYS.filter(
      (key) => jobs[key].status === "pending",
    );
    if (pending.length === 0) return null;
    return `更新中: ${pending.map((key) => OPS_REFRESH_JOB_LABELS[key]).join(" / ")}`;
  }, [jobs]);

  async function runRefreshJob(
    key: OpsRefreshJobKey,
  ): Promise<{ status: OpsRefreshJobStatus; detail: string }> {
    if (runningKeysRef.current.has(key)) {
      return { status: "error", detail: "すでに実行中です" };
    }
    runningKeysRef.current.add(key);
    setJobStatus(key, "pending", pendingDetail(key));

    try {
      const payload = await postOpsRefresh(
        key,
        OPS_REFRESH_TIMEOUT_MS[key],
        OPS_REFRESH_JOB_LABELS[key],
      );
      const outcome = evaluateSourceRefresh(key, payload);
      if (outcome.ok) {
        applyPayload(payload);
        setJobStatus(key, "success", "成功");
        return { status: "success", detail: "成功" };
      }
      setJobStatus(key, "error", outcome.detail);
      return { status: "error", detail: outcome.detail };
    } catch (error) {
      if (error instanceof OpsRefreshTimeoutError) {
        setJobStatus(key, "timeout", "タイムアウト");
        return { status: "timeout", detail: "タイムアウト" };
      }
      const detail = humanizeOpsRefreshError(error);
      setJobStatus(key, "error", detail);
      return { status: "error", detail };
    } finally {
      runningKeysRef.current.delete(key);
    }
  }

  async function refreshJobs(keys: OpsRefreshJobKey[], startedMessage: string) {
    const blocked = keys.some((key) => runningKeysRef.current.has(key));
    if (blocked) {
      setMessage("すでに更新処理が実行中です。");
      scrollToProgress();
      return;
    }

    const startedAt = Date.now();
    setRefreshStartedAt(startedAt);
    setElapsedMs(0);
    setMessage(startedMessage);

    setJobs((current) => {
      const next: JobMap = { ...current };
      for (const key of OPS_REFRESH_JOB_KEYS) {
        if (keys.includes(key)) {
          next[key] = { status: "pending", detail: pendingDetail(key) };
        } else if (keys.length > 1) {
          next[key] = { status: "idle", detail: "" };
        }
      }
      return next;
    });

    const settled = await Promise.all(
      keys.map(async (key) => ({
        key,
        result: await runRefreshJob(key),
      })),
    );

    const successCount = settled.filter(
      (row) => row.result.status === "success",
    ).length;
    const failCount = settled.filter(
      (row) =>
        row.result.status === "error" || row.result.status === "timeout",
    ).length;

    setElapsedMs(Date.now() - startedAt);
    setMessage(
      failCount === 0
        ? keys.length === 1
          ? `${OPS_REFRESH_JOB_LABELS[keys[0]]}の更新が完了しました。`
          : "すべての更新が完了しました。"
        : `更新完了（成功 ${successCount} / 失敗 ${failCount}）。成功したデータのみ表示を更新しています。`,
    );
  }

  function refreshAll() {
    if (anyJobPending) {
      scrollToProgress();
      return;
    }
    void refreshJobs([...OPS_REFRESH_JOB_KEYS], "更新を開始しました");
  }

  function refreshSource(key: OpsRefreshJobKey) {
    if (runningKeysRef.current.has(key) || jobs[key].status === "pending") {
      scrollToProgress();
      return;
    }
    void refreshJobs(
      [key],
      `${OPS_REFRESH_JOB_LABELS[key]}の更新を開始しました`,
    );
  }

  function uploadDmm(file: File, type: "category" | "direct") {
    startUploadTransition(async () => {
      setMessage(null);
      try {
        const body = new FormData();
        body.append("file", file);
        body.append("type", type);
        const response = await fetch("/api/admin/dmm/upload", {
          method: "POST",
          body,
        });
        const text = await response.text();
        let json: {
          success?: boolean;
          error?: string;
          inserted?: number;
          updated?: number;
          total?: number;
          data?: OpsDashboardPayload;
        } = {};
        try {
          json = text ? (JSON.parse(text) as typeof json) : {};
        } catch {
          throw new Error(
            humanizeOpsRefreshError(
              text.includes("<")
                ? "APIがHTMLを返しました"
                : "アップロード応答の解析に失敗しました。",
            ),
          );
        }
        if (!response.ok || !json.success) {
          throw new Error(
            humanizeOpsRefreshError(
              json.error ?? "アップロードに失敗しました。",
            ),
          );
        }
        if (json.data) {
          applyPayload(json.data);
        }
        const typeLabel = type === "category" ? "カテゴリ" : "ダイレクト";
        setMessage(
          `${typeLabel}CSV取込完了: 新規 ${json.inserted ?? 0} / 更新 ${json.updated ?? 0} / 合計 ${json.total ?? 0} 件`,
        );
      } catch (error) {
        setMessage(humanizeOpsRefreshError(error));
      }
    });
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminDashboardHeader
        updatedAt={data.top.updatedAt}
        refreshing={anyJobPending}
        refreshingLabel={refreshingLabel}
        onRefreshAll={refreshAll}
        onNavigateTab={changeTab}
      />

      <div ref={progressRef}>
        <OpsRefreshProgress
          jobs={jobs}
          startedAt={refreshStartedAt}
          elapsedMs={elapsedMs}
          message={message}
        />
      </div>

      {!refreshStartedAt && message ? (
        <p className="rounded-lg border border-border bg-white px-3 py-3 text-sm text-foreground sm:px-4">
          {message}
        </p>
      ) : null}

      {activeTab === "overview" ? (
        <OpsOverviewTab
          data={data}
          tasks={tasks}
          onCompleteTask={completeTask}
          onNavigateTab={changeTab}
        />
      ) : null}

      {activeTab === "search-console" ? (
        <div className="mx-auto max-w-[1400px]">
          <OpsSearchConsoleTab
            data={data}
            period={gscPeriod}
            onPeriodChange={setGscPeriod}
            refreshing={jobs.seo.status === "pending"}
            onRefresh={() => refreshSource("seo")}
          />
        </div>
      ) : null}

      {activeTab === "ga4" ? (
        <div className="mx-auto max-w-[1400px]">
          <OpsGa4Tab
            data={data}
            period={ga4Period}
            onPeriodChange={setGa4Period}
            refreshing={jobs.ga4.status === "pending"}
            onRefresh={() => refreshSource("ga4")}
          />
        </div>
      ) : null}

      {activeTab === "dmm" ? (
        <div className="mx-auto max-w-[1400px]">
          <OpsDmmTab
            data={data}
            period={dmmPeriod}
            onPeriodChange={setDmmPeriod}
            refreshing={jobs.dmm.status === "pending"}
            onRefresh={() => refreshSource("dmm")}
            uploadPending={uploadPending}
            onUpload={uploadDmm}
          />
        </div>
      ) : null}

      <p className="text-xs text-muted">
        自動更新: 毎日 5:00 / 17:00（JST）。前期間比の上昇は緑、下降は赤で表示。
      </p>
    </div>
  );
}
