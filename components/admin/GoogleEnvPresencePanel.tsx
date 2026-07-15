"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  EnvPresenceLabel,
  GoogleEnvPresence,
} from "@/lib/admin/google-env-presence-types";

type StatusPayload = {
  success?: boolean;
  runtimeEnvironment?: string;
  env?: GoogleEnvPresence;
  configured?: boolean;
  reads?: readonly string[];
  error?: string;
};

function PresenceRow({
  name,
  value,
}: {
  name: string;
  value: EnvPresenceLabel | undefined;
}) {
  const present = value === "存在する";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-3 text-sm">
      <code className="break-all text-xs sm:text-sm">{name}</code>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
          present
            ? "bg-emerald-100 text-emerald-800"
            : "bg-red-100 text-red-800"
        }`}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

export function GoogleEnvPresencePanel() {
  const [env, setEnv] = useState<GoogleEnvPresence | null>(null);
  const [runtime, setRuntime] = useState<string>("—");
  const [gscConfigured, setGscConfigured] = useState<boolean | null>(null);
  const [ga4Configured, setGa4Configured] = useState<boolean | null>(null);
  const [gscReads, setGscReads] = useState<string[]>([]);
  const [ga4Reads, setGa4Reads] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gscRes, ga4Res] = await Promise.all([
        fetch("/api/admin/search-console/status"),
        fetch("/api/admin/ga4/status"),
      ]);
      const gsc = (await gscRes.json()) as StatusPayload;
      const ga4 = (await ga4Res.json()) as StatusPayload;

      if (!gscRes.ok || !ga4Res.ok) {
        throw new Error(gsc.error || ga4.error || "状態の取得に失敗しました。");
      }

      // 両 API とも同じ env 判定を返す（値なし）
      setEnv(gsc.env ?? ga4.env ?? null);
      setRuntime(gsc.runtimeEnvironment ?? ga4.runtimeEnvironment ?? "—");
      setGscConfigured(gsc.configured ?? null);
      setGa4Configured(ga4.configured ?? null);
      setGscReads([...(gsc.reads ?? [])]);
      setGa4Reads([...(ga4.reads ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "状態の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground">
            環境変数の認識状況
          </h2>
          <p className="mt-1 text-xs text-muted">
            値は表示しません。この実行環境（{runtime}）でキーがあるかだけです。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="min-h-[40px] rounded-xl border border-border px-3 text-sm disabled:opacity-50"
        >
          {loading ? "確認中…" : "再確認"}
        </button>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <PresenceRow
          name="GOOGLE_SERVICE_ACCOUNT_JSON"
          value={env?.GOOGLE_SERVICE_ACCOUNT_JSON}
        />
        <PresenceRow name="GA4_PROPERTY_ID" value={env?.GA4_PROPERTY_ID} />
        <PresenceRow name="GSC_SITE_URL" value={env?.GSC_SITE_URL} />
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-white/80 p-3">
          <dt className="text-xs text-muted">Search Console</dt>
          <dd className="mt-1 font-medium">
            {gscConfigured == null ? "—" : gscConfigured ? "利用可能" : "未設定"}
          </dd>
        </div>
        <div className="rounded-xl bg-white/80 p-3">
          <dt className="text-xs text-muted">GA4 Data API</dt>
          <dd className="mt-1 font-medium">
            {ga4Configured == null ? "—" : ga4Configured ? "利用可能" : "未設定"}
          </dd>
        </div>
      </dl>

      <details className="rounded-xl border border-border bg-white/60 p-3 text-xs text-muted">
        <summary className="cursor-pointer font-medium text-foreground">
          各 status API が読む環境変数
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <p className="font-medium text-foreground">
              GET /api/admin/search-console/status
            </p>
            <ul className="mt-1 list-inside list-disc">
              {gscReads.map((name) => (
                <li key={`gsc-${name}`}>
                  <code>{name}</code>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">
              GET /api/admin/ga4/status
            </p>
            <ul className="mt-1 list-inside list-disc">
              {ga4Reads.map((name) => (
                <li key={`ga4-${name}`}>
                  <code>{name}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}
