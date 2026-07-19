"use client";

import { useCallback, useEffect, useState } from "react";
import { expandSourceLabel } from "@/lib/admin/fanza-expand-sources-client";
import type {
  FanzaExpandJob,
  FanzaExpandSource,
} from "@/lib/admin/fanza-expand-types";

type ExpandOverview = {
  ok?: boolean;
  job: FanzaExpandJob | null;
  currentWorkCount: number;
  targetCount: number;
  remainingCount: number;
  running: boolean;
  writeAllowed: boolean;
  localCliCommand: string;
  notice: string;
  error?: string;
  message?: string;
  code?: string;
};

const SOURCE_BUTTONS: Array<{ source: FanzaExpandSource; label: string }> = [
  { source: "popular", label: "人気順取得" },
  { source: "new", label: "新着取得" },
  { source: "genre", label: "ジャンル取得" },
  { source: "maker", label: "メーカー取得" },
  { source: "label", label: "レーベル取得" },
  { source: "series", label: "シリーズ取得" },
  { source: "actress", label: "女優取得" },
];

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct =
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="mt-2 h-2 overflow-hidden rounded bg-zinc-200">
      <div
        className="h-full rounded bg-sky-600 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function WorksCmsExpandTab() {
  const [overview, setOverview] = useState<ExpandOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState(30000);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/fanza-expand", { cache: "no-store" });
    const data = (await res.json()) as ExpandOverview;
    setOverview(data);
    if (data.targetCount) setTarget(data.targetCount);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!overview?.running || !overview.writeAllowed) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          await fetch("/api/admin/fanza-expand", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "tick" }),
          });
          await refresh();
        } catch {
          // ignore poll errors
        }
      })();
    }, 4000);
    return () => clearInterval(timer);
  }, [overview?.running, overview?.writeAllowed, refresh]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/fanza-expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ExpandOverview & {
        localCliCommand?: string;
        notice?: string;
      };
      if (!res.ok) {
        setMessage(
          data.message ||
            data.error ||
            data.notice ||
            (data.localCliCommand
              ? `ローカルで実行: ${data.localCliCommand}`
              : "リクエストに失敗しました"),
        );
      } else if (data.notice) {
        setMessage(data.notice);
      } else if (data.localCliCommand && body.action === "register") {
        setMessage(`ジョブ登録済み。${data.localCliCommand}`);
      }
      setOverview(data);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const job = overview?.job ?? null;
  const current = overview?.currentWorkCount ?? 0;
  const targetCount = overview?.targetCount ?? target;
  const remaining = overview?.remainingCount ?? Math.max(0, targetCount - current);
  const writeAllowed = overview?.writeAllowed ?? false;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-white p-4">
        <h2 className="text-base font-bold">30,000件まで拡張</h2>
        <p className="mt-1 text-sm text-muted">
          画像なし作品は登録しません。重複は content_id / cid / product_id
          で除外します。重い取得は Mac ローカル CLI で実行してください。
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="現在作品数" value={current.toLocaleString("ja-JP")} />
          <Stat
            label="30,000件まで残り"
            value={remaining.toLocaleString("ja-JP")}
          />
          <Stat
            label="最終取得"
            value={job?.lastFetchAt ? new Date(job.lastFetchAt).toLocaleString("ja-JP") : "—"}
          />
          <Stat
            label="実行中処理"
            value={
              job?.status === "RUNNING"
                ? `${expandSourceLabel(job.cursor.source)}${
                    job.cursor.entityName ? ` / ${job.cursor.entityName}` : ""
                  }`
                : job?.status ?? "なし"
            }
          />
          <Stat
            label="新規追加"
            value={(job?.newAddedCount ?? 0).toLocaleString("ja-JP")}
          />
          <Stat
            label="更新"
            value={(job?.updatedCount ?? 0).toLocaleString("ja-JP")}
          />
          <Stat
            label="重複除外"
            value={(job?.duplicateCount ?? 0).toLocaleString("ja-JP")}
          />
          <Stat
            label="画像除外"
            value={(job?.noImageExcludedCount ?? 0).toLocaleString("ja-JP")}
          />
          <Stat
            label="エラー"
            value={(job?.errorCount ?? 0).toLocaleString("ja-JP")}
          />
        </div>

        <p className="mt-4 text-sm font-medium">
          {current.toLocaleString("ja-JP")} / {targetCount.toLocaleString("ja-JP")}
        </p>
        <ProgressBar current={current} target={targetCount} />

        {overview?.notice ? (
          <p className="mt-3 text-xs text-amber-800">{overview.notice}</p>
        ) : null}
        {job?.stopReason ? (
          <p className="mt-1 text-xs text-muted">停止理由: {job.stopReason}</p>
        ) : null}
        {job?.lastError ? (
          <p className="mt-1 text-xs text-red-700">{job.lastError}</p>
        ) : null}
        {message ? (
          <p className="mt-2 rounded bg-zinc-50 px-3 py-2 text-xs text-foreground">
            {message}
          </p>
        ) : null}

        <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs">
          {overview?.localCliCommand ??
            `npm run fanza:expand -- --target=${target}`}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            目標件数
            <input
              type="number"
              min={1}
              value={target}
              disabled={busy}
              onChange={(e) => setTarget(Number(e.target.value) || 30000)}
              className="mt-1 w-28 rounded border border-border px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void post({
                action: writeAllowed ? "start" : "register",
                targetCount: target,
              })
            }
            className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            30,000件まで取得
          </button>
          <button
            type="button"
            disabled={busy || !job || job.status !== "RUNNING"}
            onClick={() => void post({ action: "pause", jobId: job?.id })}
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            一時停止
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void post({
                action: writeAllowed ? "resume" : "register",
                targetCount: target,
              })
            }
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            再開
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SOURCE_BUTTONS.map((btn) => (
            <button
              key={btn.source}
              type="button"
              disabled={busy}
              onClick={() =>
                void post({
                  action: writeAllowed ? "start" : "register",
                  source: btn.source,
                  targetCount: target,
                })
              }
              className="rounded-lg border border-border bg-zinc-50 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50"
            >
              {btn.label}
            </button>
          ))}
        </div>

        {!writeAllowed ? (
          <p className="mt-3 text-xs text-muted">
            本番ではボタンはジョブ案内のみです。実際の取得は CLI で実行してください。
          </p>
        ) : null}
      </section>
    </div>
  );
}
