"use client";

import { useCallback, useState } from "react";

type Candidate = {
  imageUrl: string;
  contentId: string;
  score: number;
  isSoloWork: boolean;
  faceLikely: boolean;
  isCompilation: boolean;
  reason: string;
};

type Review = {
  actressName: string;
  slug: string;
  workCount: number;
  selectionVersion: number;
  override: { key: string; useDefault?: boolean; imageUrl?: string } | null;
  selection: {
    imageUrl: string;
    workId: string | null;
    score: number;
    reason: string;
    faceDetected: boolean;
    isSoloWork: boolean;
  } | null;
  candidates: Candidate[];
};

export function ActressImageAdminClient() {
  const [nameInput, setNameInput] = useState("渚みつき");
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReview = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/actress-images?name=${encodeURIComponent(name)}`,
      );
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "取得に失敗しました。");
      }
      setReview(body.review as Review);
    } catch (err) {
      setReview(null);
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  const applyMode = useCallback(
    async (
      mode: "pick" | "default" | "clear",
      candidate?: Candidate,
    ) => {
      if (!review) return;
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const response = await fetch("/api/admin/actress-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actressName: review.actressName,
            mode,
            imageUrl: candidate?.imageUrl,
            workId: candidate?.contentId,
            isSoloWork: candidate?.isSoloWork,
            faceDetected: candidate?.faceLikely,
            score: candidate?.score,
          }),
        });
        const body = await response.json();
        if (!response.ok || !body.success) {
          throw new Error(body.error ?? "更新に失敗しました。");
        }
        setReview(body.review as Review);
        setMessage(
          mode === "clear"
            ? "手動設定を解除し、自動選定に戻しました。"
            : mode === "default"
              ? "デフォルト画像（非表示）に設定しました。"
              : "代表画像を手動選択しました。",
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新に失敗しました。");
      } finally {
        setLoading(false);
      }
    },
    [review],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold text-foreground">女優代表画像</h1>
        <p className="mt-2 text-sm text-muted">
          単体作品・顔が写りやすいパッケージを優先する自動選定結果を確認できます。
          手動選択は自動選定で上書きされません。
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block text-sm">
            <span className="text-muted">女優名</span>
            <input
              className="mt-1 w-64 rounded-lg border border-border px-3 py-2"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={loading || !nameInput.trim()}
            onClick={() => loadReview(nameInput.trim())}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "読み込み中…" : "確認"}
          </button>
          {review ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => loadReview(review.actressName)}
              className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50"
            >
              再選定（自動再計算）
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      </section>

      {review ? (
        <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-foreground">
            {review.actressName}（作品 {review.workCount}件）
          </h2>
          <p className="mt-1 text-xs text-muted">
            selectionVersion: {review.selectionVersion}
            {review.override ? " / 手動オーバーライドあり" : ""}
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              {review.selection?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={review.selection.imageUrl}
                  alt={review.actressName}
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted">
                  デフォルト（画像なし）
                </div>
              )}
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">選定元作品</dt>
                <dd>{review.selection?.workId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">単体作品</dt>
                <dd>{review.selection?.isSoloWork ? "はい" : "いいえ"}</dd>
              </div>
              <div>
                <dt className="text-muted">顔検出（推定）</dt>
                <dd>
                  {review.selection?.faceDetected
                    ? "顔が写りやすい"
                    : "低〜不明"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">スコア</dt>
                <dd>{review.selection?.score ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">選定理由</dt>
                <dd>{review.selection?.reason ?? "default-image"}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => applyMode("default")}
              className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
            >
              デフォルトへ戻す
            </button>
            <button
              type="button"
              disabled={loading || !review.override}
              onClick={() => applyMode("clear")}
              className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
            >
              手動設定を解除
            </button>
          </div>

          <h3 className="mt-6 text-sm font-bold text-foreground">
            候補画像（スコア順）
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {review.candidates.map((candidate) => (
              <article
                key={candidate.contentId}
                className="overflow-hidden rounded-lg border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={candidate.imageUrl}
                  alt={candidate.contentId}
                  className="h-40 w-full object-cover"
                />
                <div className="space-y-1 p-3 text-xs">
                  <p className="font-medium">{candidate.contentId}</p>
                  <p>score: {candidate.score}</p>
                  <p>
                    {candidate.isSoloWork ? "単体" : "複数"} /{" "}
                    {candidate.faceLikely ? "顔推定○" : "顔推定△"} /
                    {candidate.isCompilation ? " 総集編" : ""}
                  </p>
                  <p className="text-muted">{candidate.reason}</p>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => applyMode("pick", candidate)}
                    className="mt-2 rounded border border-border px-2 py-1 disabled:opacity-50"
                  >
                    この画像を選ぶ
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
