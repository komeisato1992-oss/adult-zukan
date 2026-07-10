"use client";

import { useCallback, useState } from "react";
import { SeoCrawlErrorsTab } from "@/components/admin/seo/SeoCrawlErrorsTab";
import { SeoIndexTab } from "@/components/admin/seo/SeoIndexTab";
import { SeoOverviewTab } from "@/components/admin/seo/SeoOverviewTab";
import { SeoPagesTab } from "@/components/admin/seo/SeoPagesTab";
import { SeoQueriesTab } from "@/components/admin/seo/SeoQueriesTab";
import { SeoSitemapsTab } from "@/components/admin/seo/SeoSitemapsTab";
import { formatSeoDateTime } from "@/components/admin/seo/format";
import { SeoEnvDiagnosticsPanel } from "@/components/admin/seo/SeoEnvDiagnosticsPanel";
import type { SeoEnvDiagnostics } from "@/lib/admin/seo-env-diagnostics";
import type { SeoCachePayload, SeoTabId } from "@/lib/admin/seo-types";
import { SEO_TABS } from "@/lib/admin/seo-types";

type SeoDashboardClientProps = {
  initialData: SeoCachePayload;
  envDiagnostics: SeoEnvDiagnostics;
};

export function SeoDashboardClient({
  initialData,
  envDiagnostics: initialEnvDiagnostics,
}: SeoDashboardClientProps) {
  const [data, setData] = useState(initialData);
  const [envDiagnostics, setEnvDiagnostics] = useState(initialEnvDiagnostics);
  const [activeTab, setActiveTab] = useState<SeoTabId>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [submittingSitemap, setSubmittingSitemap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/seo/refresh", { method: "POST" });
      const payload = (await response.json()) as {
        data?: SeoCachePayload;
        envDiagnostics?: SeoEnvDiagnostics;
        error?: string;
        configured?: boolean;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "更新に失敗しました。");
      }
      if (payload.data) {
        setData(payload.data);
        if (payload.envDiagnostics) {
          setEnvDiagnostics(payload.envDiagnostics);
        }
        if (!payload.data.configured && payload.data.configMessage) {
          setError(null);
        }
      }
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "更新に失敗しました。",
      );
    } finally {
      setRefreshing(false);
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
      if (payload.data) {
        setData(payload.data);
      }
      if (payload.envDiagnostics) {
        setEnvDiagnostics(payload.envDiagnostics);
      }
    } catch (submitError) {
      throw submitError;
    } finally {
      setSubmittingSitemap(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">最終更新</p>
          <p className="mt-1 text-base font-medium text-foreground">
            {formatSeoDateTime(data.updatedAt)}
          </p>
          {!data.configured && data.configMessage ? (
            <p className="mt-2 text-sm text-accent">{data.configMessage}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {refreshing ? "更新中..." : "更新"}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <SeoEnvDiagnosticsPanel diagnostics={envDiagnostics} />

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

      {activeTab === "overview" ? <SeoOverviewTab data={data} /> : null}
      {activeTab === "queries" ? <SeoQueriesTab queries={data.queries} /> : null}
      {activeTab === "pages" ? <SeoPagesTab pages={data.pages} /> : null}
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
    </div>
  );
}
