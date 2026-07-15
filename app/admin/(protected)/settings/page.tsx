"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GoogleEnvPresencePanel } from "@/components/admin/GoogleEnvPresencePanel";

export default function AdminSettingsPage() {
  const [lightSyncEnabled, setLightSyncEnabled] = useState(false);
  const [fullSyncEnabled, setFullSyncEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ops-settings");
      const data = await response.json();
      if (response.ok) {
        setLightSyncEnabled(Boolean(data.lightSyncEnabled));
        setFullSyncEnabled(Boolean(data.fullSyncEnabled));
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
            <p className="text-xs text-muted">価格・セール・順位などの更新</p>
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
            <p className="text-xs text-muted">全データ再取得（高負荷）</p>
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

      <Link
        href="/admin/import"
        className="inline-flex min-h-[48px] items-center rounded-xl bg-sky-600 px-4 font-bold text-white"
      >
        作品管理へ戻る
      </Link>
    </div>
  );
}
