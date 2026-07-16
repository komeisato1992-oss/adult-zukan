"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GoogleEnvPresencePanel } from "@/components/admin/GoogleEnvPresencePanel";

function syncStatusText(status: string | undefined, enabled: boolean): string {
  if (status === "enabled") return "有効：実行可能";
  if (status === "disabled") return "無効：設定が必要";
  if (status === "unset") return "未設定：環境変数未設定";
  return enabled ? "有効：実行可能" : "無効：設定が必要";
}

export default function AdminSettingsPage() {
  const [lightSyncEnabled, setLightSyncEnabled] = useState(false);
  const [fullSyncEnabled, setFullSyncEnabled] = useState(false);
  const [lightSyncStatus, setLightSyncStatus] = useState<string>("unset");
  const [fullSyncStatus, setFullSyncStatus] = useState<string>("unset");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ops-settings", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setLightSyncEnabled(Boolean(data.lightSyncEnabled));
        setFullSyncEnabled(Boolean(data.fullSyncEnabled));
        setLightSyncStatus(String(data.lightSyncStatus ?? "unset"));
        setFullSyncStatus(String(data.fullSyncStatus ?? "unset"));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async (patch: {
    lightSyncEnabled?: boolean;
    fullSyncEnabled?: boolean;
  }) => {
    setMessage(null);
    const response = await fetch("/api/admin/ops-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      setMessage(data.message ?? "保存に失敗しました。");
      return;
    }
    setLightSyncEnabled(Boolean(data.lightSyncEnabled));
    setFullSyncEnabled(Boolean(data.fullSyncEnabled));
    setLightSyncStatus(String(data.lightSyncStatus ?? "unset"));
    setFullSyncStatus(String(data.fullSyncStatus ?? "unset"));
    setMessage("設定を保存しました。");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <section>
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold">設定</h1>
        <p className="mt-2 text-sm text-muted">
          運用スイッチと、この実行環境で認識している Google 連携の環境変数。
        </p>
      </section>

      {message ? (
        <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm">{message}</p>
      ) : null}

      <GoogleEnvPresencePanel />

      <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">軽量同期</p>
            <p className="text-xs text-muted">
              {syncStatusText(lightSyncStatus, lightSyncEnabled)}
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void save({ lightSyncEnabled: !lightSyncEnabled })}
            className={`min-h-[44px] min-w-[88px] rounded-xl px-4 font-bold text-white ${
              lightSyncEnabled ? "bg-sky-600" : "bg-zinc-400"
            }`}
          >
            {lightSyncEnabled ? "ON" : "OFF"}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">完全同期</p>
            <p className="text-xs text-muted">
              {syncStatusText(fullSyncStatus, fullSyncEnabled)}（高負荷）
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void save({ fullSyncEnabled: !fullSyncEnabled })}
            className={`min-h-[44px] min-w-[88px] rounded-xl px-4 font-bold text-white ${
              fullSyncEnabled ? "bg-sky-600" : "bg-zinc-400"
            }`}
          >
            {fullSyncEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4 space-y-2">
        <p className="font-bold">コード変更時の本番反映</p>
        <p className="text-xs text-muted">
          作品追加・価格更新・公開状態の変更ではデプロイ不要です。UIやコードを本番へ反映するときだけ使います。
        </p>
        <Link
          href="/admin/deploy"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-border px-4 text-sm font-bold"
        >
          デプロイ・本番反映ページへ
        </Link>
      </section>

      <Link
        href="/admin/import"
        className="inline-flex min-h-[48px] items-center rounded-xl bg-sky-600 px-4 font-bold text-white"
      >
        作品管理へ戻る
      </Link>
    </div>
  );
}
