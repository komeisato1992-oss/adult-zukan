"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SeoCompactAlert, SeoUnconfiguredNotice } from "@/components/admin/seo/SeoCompactAlert";
import { SeoCrawlErrorsTab } from "@/components/admin/seo/SeoCrawlErrorsTab";
import { SeoDashboardHeader } from "@/components/admin/seo/SeoDashboardHeader";
import {
  SeoDevInfoPanel,
  type SeoDevInfoPanelHandle,
} from "@/components/admin/seo/SeoDevInfoPanel";
import { SeoIndexTab } from "@/components/admin/seo/SeoIndexTab";
import { SeoOverviewTab } from "@/components/admin/seo/SeoOverviewTab";
import { SeoPagesTab } from "@/components/admin/seo/SeoPagesTab";
import { SeoPeriodSelector } from "@/components/admin/seo/SeoPeriodSelector";
import { SeoQueriesTab } from "@/components/admin/seo/SeoQueriesTab";
import { SeoSitemapsTab } from "@/components/admin/seo/SeoSitemapsTab";
import type { SeoEnvDiagnostics } from "@/lib/admin/seo-env-diagnostics";
import { getPeriodBundle } from "@/lib/admin/seo-insights";
import { parseSeoPeriodDays } from "@/lib/admin/seo-period";
import type {
  SeoCachePayload,
  SeoChanceTabId,
  SeoPeriodDays,
  SeoTabId,
} from "@/lib/admin/seo-types";
import { SEO_TABS } from "@/lib/admin/seo-types";

type SeoDashboardClientProps = {
  initialData: SeoCachePayload;
  envDiagnostics: SeoEnvDiagnostics;
};

export function SeoDashboardClient({
  initialData,
  envDiagnostics: initialEnvDiagnostics,
}: SeoDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const devInfoRef = useRef<SeoDevInfoPanelHandle>(null);

  const [data, setData] = useState(initialData);
  const [envDiagnostics, setEnvDiagnostics] = useState(initialEnvDiagnostics);
  const [activeTab, setActiveTab] = useState<SeoTabId>("overview");
  const [chanceTab, setChanceTab] = useState<SeoChanceTabId>("ctr");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingSitemaps, setRefreshingSitemaps] = useState(false);
  const [submittingSitemap, setSubmittingSitemap] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const period = parseSeoPeriodDays(searchParams.get("period"));

  const connectionStatus = useMemo(() => {
    if (!data.configured) return "unconfigured" as const;
    if (data.connectionStatus === "error") return "error" as const;
    if (data.connectionStatus === "connected") return "connected" as const;
    return data.updatedAt ? ("connected" as const) : ("error" as const);
  }, [data.configured, data.connectionStatus, data.updatedAt]);

  const setPeriod = useCallback(
    (nextPeriod: SeoPeriodDays) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", String(nextPeriod));
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setErrorDetails(null);
    setToast(null);
    try {
      const response = await fetch("/api/admin/seo/refresh", { method: "POST" });
      const payload = (await response.json()) as {
        data?: SeoCachePayload;
        envDiagnostics?: SeoEnvDiagnostics;
        error?: string;
        message?: string;
        phase?: string;
        apiMethod?: string;
        googleStatus?: string;
        githubStatus?: number;
        errors?: Array<{ message?: string; reason?: string }>;
      };

      if (payload.envDiagnostics) {
        setEnvDiagnostics(payload.envDiagnostics);
      }

      if (payload.data) {
        setData(payload.data);
      }

      if (!response.ok) {
        const detailParts = [
          payload.apiMethod ? `API: ${payload.apiMethod}` : null,
          payload.googleStatus ? `Google status: ${payload.googleStatus}` : null,
          payload.errors?.length
            ? payload.errors
                .map(
                  (entry) =>
                    [entry.reason, entry.message].filter(Boolean).join(": "),
                )
                .join("\n")
            : null,
        ].filter(Boolean);
        setErrorDetails(detailParts.join("\n") || null);
        setError(payload.message ?? payload.error ?? "最新データの取得に失敗しました。");
        if (payload.data?.stale) {
          setToast("最新取得に失敗したため、前回取得データを表示しています。");
        }
        return;
      }

      setToast("Search Consoleデータを更新しました。");
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "最新データの取得に失敗しました。",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  const refreshSitemaps = useCallback(async () => {
    setRefreshingSitemaps(true);
    setToast(null);
    try {
      const response = await fetch("/api/admin/seo/refresh-sitemaps", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        data?: SeoCachePayload;
        message?: string;
        error?: string;
      };
      if (payload.data) {
        setData(payload.data);
      }
      if (!response.ok || payload.error) {
        setToast(payload.error ?? "サイトマップ情報の再取得に失敗しました。");
        return;
      }
      setToast(payload.message ?? "サイトマップ情報を再取得しました。");
    } catch (refreshError) {
      setToast(
        refreshError instanceof Error
          ? refreshError.message
          : "サイトマップ情報の再取得に失敗しました。",
      );
    } finally {
      setRefreshingSitemaps(false);
    }
  }, []);

  const submitSitemap = useCallback(async () => {
    setSubmittingSitemap(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/seo/submit-sitemap", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        data?: SeoCachePayload;
        envDiagnostics?: SeoEnvDiagnostics;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "サイトマップ送信に失敗しました。");
      }
      if (payload.data) setData(payload.data);
      if (payload.envDiagnostics) setEnvDiagnostics(payload.envDiagnostics);
      setToast("サイトマップを送信しました。");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "サイトマップ送信に失敗しました。",
      );
    } finally {
      setSubmittingSitemap(false);
    }
  }, []);

  const periodBundle = getPeriodBundle(data, period);

  function handleNavigate(options: {
    tab?: SeoTabId;
    chanceTab?: SeoChanceTabId;
  }) {
    if (options.tab) setActiveTab(options.tab);
    if (options.chanceTab) setChanceTab(options.chanceTab);
  }

  return (
    <div className="space-y-6">
      <SeoDashboardHeader
        connectionStatus={connectionStatus}
        updatedAt={data.updatedAt}
        stale={data.stale}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">期間</p>
          <p className="text-xs text-muted">比較対象は直前の同じ日数です</p>
        </div>
        <SeoPeriodSelector value={period} onChange={setPeriod} />
      </div>

      {toast ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {toast}
        </div>
      ) : null}

      {error ? (
        <SeoCompactAlert
          message={error}
          details={errorDetails ?? undefined}
          onRetry={refresh}
          onOpenDevInfo={() => devInfoRef.current?.open()}
          staleNotice={
            data.stale
              ? "最新取得に失敗したため、前回取得データを表示しています。"
              : undefined
          }
        />
      ) : null}

      {!data.configured && data.configMessage ? (
        <SeoUnconfiguredNotice />
      ) : null}

      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 rounded-xl border border-border bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
          {SEO_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                activeTab === tab.id
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <SeoOverviewTab
          data={data}
          period={period}
          chanceTab={chanceTab}
          onChanceTabChange={setChanceTab}
          onNavigate={handleNavigate}
          onRefreshSitemaps={refreshSitemaps}
          refreshingSitemaps={refreshingSitemaps}
        />
      ) : null}
      {activeTab === "queries" ? (
        <SeoQueriesTab
          queries={periodBundle.queries}
          previousQueries={periodBundle.previousQueries}
        />
      ) : null}
      {activeTab === "pages" ? (
        <SeoPagesTab
          pages={periodBundle.pages}
          previousPages={periodBundle.previousPages}
        />
      ) : null}
      {activeTab === "index" ? <SeoIndexTab index={data.index} /> : null}
      {activeTab === "sitemaps" ? (
        <SeoSitemapsTab
          sitemaps={data.sitemaps}
          onSubmit={submitSitemap}
          submitting={submittingSitemap}
        />
      ) : null}
      {activeTab === "crawl-errors" ? (
        <SeoCrawlErrorsTab crawlErrors={data.crawlErrors} />
      ) : null}

      <SeoDevInfoPanel ref={devInfoRef} diagnostics={envDiagnostics} />
    </div>
  );
}
