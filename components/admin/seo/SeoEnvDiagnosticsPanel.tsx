import type { SeoEnvDiagnostics } from "@/lib/admin/seo-env-diagnostics";

type SeoEnvDiagnosticsPanelProps = {
  diagnostics: SeoEnvDiagnostics;
};

export function SeoEnvDiagnosticsPanel({
  diagnostics,
}: SeoEnvDiagnosticsPanelProps) {
  return (
    <section className="rounded-xl border border-border bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-base font-bold text-foreground">環境変数の読み込み状況</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-muted">実行環境</dt>
          <dd className="font-medium text-foreground">
            {diagnostics.runtime} / {diagnostics.nodeEnv}
            {diagnostics.vercelEnv ? ` (${diagnostics.vercelEnv})` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted">キャッシュ</dt>
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

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
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

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
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

      <details className="mt-4">
        <summary className="cursor-pointer text-muted">サーバーログ</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-3 text-xs text-foreground">
          {diagnostics.logs.join("\n")}
        </pre>
      </details>
    </section>
  );
}
