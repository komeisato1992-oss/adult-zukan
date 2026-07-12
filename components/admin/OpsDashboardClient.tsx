"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OpsOverviewTab } from "@/components/admin/ops/OpsOverviewTab";
import { OpsSearchConsoleTab } from "@/components/admin/ops/OpsSearchConsoleTab";
import { OpsGa4Tab } from "@/components/admin/ops/OpsGa4Tab";
import { OpsDmmTab } from "@/components/admin/ops/OpsDmmTab";
import { OpsTabNav } from "@/components/admin/ops/OpsTabNav";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import {
  opsTabHref,
  parseOpsTab,
  type OpsTabId,
} from "@/lib/admin/ops-tabs";
import type {
  OpsDashboardPayload,
  OpsDmmPeriod,
  OpsGscPeriod,
  OpsGa4Period,
  OpsRefreshSource,
  OpsTask,
} from "@/lib/admin/ops-types";

type OpsDashboardClientProps = {
  initialData: OpsDashboardPayload;
  initialTab?: string | null;
};

type RefreshStepResult = {
  label: string;
  ok: boolean;
  detail: string;
};

function summarizeError(detail: string, max = 180): string {
  const compact = detail.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}…`;
}

function evaluateSourceRefresh(
  source: OpsRefreshSource,
  payload: OpsDashboardPayload,
): { ok: boolean; detail: string } {
  if (source === "ga4") {
    if (payload.ga4.fetchError || payload.ga4.connectionStatus === "error") {
      return {
        ok: false,
        detail: summarizeError(
          payload.ga4.authDiagnostics?.errorCode
            ? `${payload.ga4.authDiagnostics.errorCode}: ${payload.ga4.fetchError ?? "取得失敗"}`
            : payload.ga4.fetchError ?? "GA4取得に失敗しました。",
        ),
      };
    }
    if (!payload.ga4.lastSuccessfulAt && payload.ga4.connectionStatus !== "connected") {
      return { ok: false, detail: "GA4データを取得できませんでした。" };
    }
    return { ok: true, detail: "成功" };
  }

  if (source === "seo") {
    if (payload.seo.fetchError || payload.seo.connectionStatus === "error") {
      return {
        ok: false,
        detail: summarizeError(
          payload.seo.fetchError ?? "Search Console取得に失敗しました。",
        ),
      };
    }
    if (!payload.seo.updatedAt && payload.seo.connectionStatus !== "connected") {
      return { ok: false, detail: "Search Consoleデータを取得できませんでした。" };
    }
    return { ok: true, detail: "成功" };
  }

  if (source === "dmm") {
    if (payload.dmm.fetchError || payload.dmm.connectionStatus === "error") {
      return {
        ok: false,
        detail: summarizeError(
          payload.dmm.fetchError ?? "DMM成果の取得に失敗しました。",
        ),
      };
    }
    if (payload.dmm.rowCount <= 0 && payload.dmm.connectionStatus === "unconfigured") {
      return {
        ok: false,
        detail: "DMM成果データが未取込です。CSVをアップロードしてください。",
      };
    }
    return { ok: true, detail: "成功" };
  }

  return { ok: true, detail: "成功" };
}

async function postOpsRefresh(source: OpsRefreshSource): Promise<OpsDashboardPayload> {
  const response = await fetch("/api/admin/ops/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  const json = (await response.json()) as {
    success?: boolean;
    data?: OpsDashboardPayload;
    error?: string;
  };
  if (!response.ok || !json.data) {
    throw new Error(json.error ?? "更新に失敗しました。");
  }
  return json.data;
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
  const [refreshProgress, setRefreshProgress] = useState<string | null>(null);
  const [refreshResults, setRefreshResults] = useState<RefreshStepResult[]>([]);
  const [refreshingSource, setRefreshingSource] = useState<OpsRefreshSource | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const [uploadPending, startUploadTransition] = useTransition();

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  const applyPayload = useCallback((payload: OpsDashboardPayload) => {
    setData(payload);
    setTasks(payload.tasks);
  }, []);

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

  function refreshSource(source: OpsRefreshSource, label: string) {
    startTransition(async () => {
      setMessage(null);
      setRefreshResults([]);
      setRefreshingSource(source);
      setRefreshProgress(`${label}中`);
      try {
        const payload = await postOpsRefresh(source);
        applyPayload(payload);
        const outcome = evaluateSourceRefresh(source, payload);
        setRefreshResults([{ label, ok: outcome.ok, detail: outcome.detail }]);
        setMessage(
          outcome.ok
            ? `${label}が完了しました。`
            : `${label}に失敗しました。${outcome.detail}`,
        );
      } catch (error) {
        const detail = summarizeError(
          error instanceof Error ? error.message : "更新に失敗しました。",
        );
        setMessage(`${label}に失敗しました。${detail}`);
        setRefreshResults([{ label, ok: false, detail }]);
        try {
          const response = await fetch("/api/admin/ops/data");
          const json = (await response.json()) as {
            data?: OpsDashboardPayload;
          };
          if (json.data) applyPayload(json.data);
        } catch {
          // keep current view
        }
      } finally {
        setRefreshingSource(null);
        setRefreshProgress(null);
      }
    });
  }

  function refreshAll() {
    startTransition(async () => {
      setMessage(null);
      setRefreshResults([]);
      const steps: Array<{ source: OpsRefreshSource; label: string }> = [
        { source: "seo", label: "Search Console更新" },
        { source: "ga4", label: "GA4更新" },
        { source: "dmm", label: "DMM更新" },
      ];
      const results: RefreshStepResult[] = [];

      for (const step of steps) {
        setRefreshingSource(step.source);
        setRefreshProgress(`${step.label}中`);
        try {
          const payload = await postOpsRefresh(step.source);
          applyPayload(payload);
          const outcome = evaluateSourceRefresh(step.source, payload);
          results.push({
            label: step.label,
            ok: outcome.ok,
            detail: outcome.detail,
          });
        } catch (error) {
          results.push({
            label: step.label,
            ok: false,
            detail: summarizeError(
              error instanceof Error ? error.message : "更新に失敗しました。",
            ),
          });
        }
      }

      setRefreshingSource(null);
      setRefreshProgress("SEOスコア計算中");
      try {
        const response = await fetch("/api/admin/ops/data");
        const json = (await response.json()) as {
          success?: boolean;
          data?: OpsDashboardPayload;
          error?: string;
        };
        if (json.data) {
          applyPayload(json.data);
          results.push({
            label: "SEOスコア・改善提案再生成",
            ok: true,
            detail: "成功",
          });
        } else {
          results.push({
            label: "SEOスコア・改善提案再生成",
            ok: false,
            detail: json.error ?? "再計算に失敗しました。",
          });
        }
      } catch (error) {
        results.push({
          label: "SEOスコア・改善提案再生成",
          ok: false,
          detail:
            error instanceof Error ? error.message : "再計算に失敗しました。",
        });
      }

      setRefreshProgress("完了");
      setRefreshResults(results);
      const failed = results.filter((row) => !row.ok).length;
      setMessage(
        failed === 0
          ? "すべての更新が完了しました。"
          : `更新完了（成功 ${results.length - failed} / 失敗 ${failed}）。成功したデータは表示を更新しています。`,
      );
      setRefreshingSource(null);
      setTimeout(() => setRefreshProgress(null), 1200);
    });
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
        const json = (await response.json()) as {
          success?: boolean;
          error?: string;
          inserted?: number;
          updated?: number;
          total?: number;
          type?: string;
          data?: OpsDashboardPayload;
        };
        if (!response.ok || !json.success) {
          throw new Error(json.error ?? "アップロードに失敗しました。");
        }
        if (json.data) {
          applyPayload(json.data);
        } else {
          const dataResponse = await fetch("/api/admin/ops/data");
          const dataJson = (await dataResponse.json()) as {
            data?: OpsDashboardPayload;
          };
          if (dataJson.data) applyPayload(dataJson.data);
        }
        const typeLabel = type === "category" ? "カテゴリ" : "ダイレクト";
        setMessage(
          `${typeLabel}CSV取込完了: 新規 ${json.inserted ?? 0} / 更新 ${json.updated ?? 0} / 合計 ${json.total ?? 0} 件`,
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "アップロードに失敗しました。",
        );
      }
    });
  }

  const busy = isPending || uploadPending;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            運営ダッシュボード
          </h1>
          <p className="mt-2 text-sm text-muted">
            Search Console / GA4 / DMM成果をタブで確認
          </p>
          <p className="mt-1 text-xs text-muted">
            最終更新: {formatSeoDateTime(data.top.updatedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={busy}
          className="min-h-11 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending && !refreshingSource ? "更新中…" : "手動更新"}
        </button>
      </section>

      <OpsTabNav activeTab={activeTab} onChange={changeTab} />

      {refreshProgress ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">
          {refreshProgress}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-border bg-white px-4 py-3 text-sm text-foreground dark:border-zinc-700 dark:bg-zinc-900">
          {message}
        </p>
      ) : null}

      {refreshResults.length > 0 ? (
        <ul className="rounded-lg border border-border bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {refreshResults.map((result) => (
            <li key={result.label} className="flex flex-wrap gap-2 py-1">
              <span className={result.ok ? "text-green-700" : "text-red-700"}>
                {result.ok ? "成功" : "失敗"}
              </span>
              <span className="font-medium text-foreground">{result.label}</span>
              <span className="text-muted">{result.detail}</span>
            </li>
          ))}
        </ul>
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
        <OpsSearchConsoleTab
          data={data}
          period={gscPeriod}
          onPeriodChange={setGscPeriod}
          refreshing={refreshingSource === "seo" || refreshingSource === "all"}
          onRefresh={() => refreshSource("seo", "Search Console更新")}
        />
      ) : null}

      {activeTab === "ga4" ? (
        <OpsGa4Tab
          data={data}
          period={ga4Period}
          onPeriodChange={setGa4Period}
          refreshing={refreshingSource === "ga4" || refreshingSource === "all"}
          onRefresh={() => refreshSource("ga4", "GA4更新")}
        />
      ) : null}

      {activeTab === "dmm" ? (
        <OpsDmmTab
          data={data}
          period={dmmPeriod}
          onPeriodChange={setDmmPeriod}
          refreshing={refreshingSource === "dmm" || refreshingSource === "all"}
          onRefresh={() => refreshSource("dmm", "DMM更新")}
          uploadPending={uploadPending}
          onUpload={uploadDmm}
        />
      ) : null}

      <p className="text-xs text-muted">
        自動更新: 毎日 5:00 / 17:00（JST）。前期間比の上昇は緑、下降は赤で表示。
      </p>
    </div>
  );
}
