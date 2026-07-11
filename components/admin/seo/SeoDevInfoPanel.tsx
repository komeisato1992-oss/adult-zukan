"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { SeoEnvDiagnostics } from "@/lib/admin/seo-env-diagnostics";

export type SeoDevInfoPanelHandle = {
  open: () => void;
};

type SeoDevInfoPanelProps = {
  diagnostics: SeoEnvDiagnostics;
};

export const SeoDevInfoPanel = forwardRef<
  SeoDevInfoPanelHandle,
  SeoDevInfoPanelProps
>(function SeoDevInfoPanel({ diagnostics }, ref) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      if (detailsRef.current) {
        detailsRef.current.open = true;
        detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
  }));

  return (
    <details
      ref={detailsRef}
      className="rounded-xl border border-border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <summary className="cursor-pointer text-base font-bold text-foreground">
        開発者情報
      </summary>

      <div className="mt-4 space-y-4 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted">実行環境</dt>
            <dd className="font-medium text-foreground">
              {diagnostics.runtime} / {diagnostics.nodeEnv}
              {diagnostics.vercelEnv ? ` (${diagnostics.vercelEnv})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted">キャッシュ方式</dt>
            <dd className="font-medium text-foreground">{diagnostics.cacheBackend}</dd>
          </div>
          <div>
            <dt className="text-muted">読み込み元</dt>
            <dd className="font-medium text-foreground">
              {diagnostics.envSources.join(", ")}
            </dd>
          </div>
          <div>
            <dt className="text-muted">サービスアカウント</dt>
            <dd className="break-all font-medium text-foreground">
              {diagnostics.googleServiceAccountJson.clientEmail ?? "—"}
            </dd>
          </div>
        </dl>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">環境変数</th>
                <th className="px-3 py-2 font-medium">取得</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(diagnostics.envPresence).map(([name, present]) => (
                <tr key={name}>
                  <td className="px-3 py-2 font-mono text-foreground">{name}</td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {present ? "true" : "false"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted">解決済み認証ソース</dt>
            <dd className="font-medium text-foreground">
              {diagnostics.googleServiceAccountJson.source ?? "none"} / parse=
              {diagnostics.googleServiceAccountJson.parseOk ? "OK" : "NG"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">GSC_SITE_URL</dt>
            <dd className="break-all font-medium text-foreground">
              {diagnostics.gscSiteUrl.present
                ? diagnostics.gscSiteUrl.value
                : "未取得"}
            </dd>
          </div>
        </dl>

        {diagnostics.connectionProbe ? (
          <div className="rounded-lg border border-border bg-surface p-3">
            <h3 className="font-medium text-foreground">Search Console 接続診断</h3>
            <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted">sites.list</dt>
                <dd className="font-medium text-foreground">
                  {diagnostics.connectionProbe.sitesListOk ? "成功" : "失敗"} (
                  {diagnostics.connectionProbe.sitesListCount} 件)
                </dd>
              </div>
              <div>
                <dt className="text-muted">searchAnalytics.query</dt>
                <dd className="font-medium text-foreground">
                  {diagnostics.connectionProbe.searchAnalyticsOk
                    ? "成功"
                    : "未確認/失敗"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">GSC_SITE_URL 一致</dt>
                <dd className="font-medium text-foreground">
                  {diagnostics.connectionProbe.configuredSiteFound ? "あり" : "なし"}
                  {diagnostics.connectionProbe.configuredSitePermission
                    ? ` (${diagnostics.connectionProbe.configuredSitePermission})`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted">利用可能プロパティ</dt>
                <dd className="break-all font-medium text-foreground">
                  {diagnostics.connectionProbe.availableSites.join(", ") || "—"}
                </dd>
              </div>
            </dl>
            {diagnostics.connectionProbe.error ? (
              <pre className="mt-3 whitespace-pre-wrap rounded bg-white p-2 text-xs text-red-700">
                {diagnostics.connectionProbe.error.apiMethod}: HTTP{" "}
                {diagnostics.connectionProbe.error.status}
                {"\n"}
                {diagnostics.connectionProbe.error.message}
              </pre>
            ) : null}
          </div>
        ) : null}

        <details>
          <summary className="cursor-pointer text-muted">サーバーログ</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-3 text-xs text-foreground">
            {diagnostics.logs.join("\n")}
          </pre>
        </details>
      </div>
    </details>
  );
});
