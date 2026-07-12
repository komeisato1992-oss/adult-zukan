"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Candidate = {
  imageUrl: string;
  contentId: string;
  score: number;
  isSoloWork: boolean;
  faceLikely: boolean;
  faceDetected?: boolean;
  faceSizeLabel?: string;
  isCompilation: boolean;
  clothingConfidence?: "high" | "medium" | "low" | "unknown";
  clothingConfidenceLabel?: string;
  imageQualityLabel?: string;
  skinExposurePenalty?: number;
  multiPersonPenalty?: number;
  textHeavyPenalty?: number;
  reason: string;
  reasonLines?: string[];
};

type Review = {
  actressName: string;
  slug: string;
  workCount: number;
  selectionVersion: number;
  isManualOverride?: boolean;
  override: {
    actress_id?: string;
    key?: string;
    useDefault?: boolean;
    image_url?: string | null;
    imageUrl?: string;
    selection_type?: string;
  } | null;
  selection: {
    imageUrl: string;
    workId: string | null;
    score: number;
    reason: string;
    faceDetected: boolean;
    isSoloWork: boolean;
    clothingConfidence?: string;
  } | null;
  candidates: Candidate[];
};

type ReselectJob = {
  status: string;
  total: number;
  processed: number;
  updated: number;
  unchanged: number;
  skippedManual: number;
  errors: number;
  progressPercent: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
};

type CandidateFilter =
  | "all"
  | "clothed"
  | "solo"
  | "face"
  | "hd"
  | "manual";

function clothingLabel(value?: string): string {
  switch (value) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default:
      return "不明";
  }
}

export function ActressImageAdminClient() {
  const [nameInput, setNameInput] = useState("渚みつき");
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [filter, setFilter] = useState<CandidateFilter>("all");
  const [job, setJob] = useState<ReselectJob | null>(null);
  const [confirmReselect, setConfirmReselect] = useState(false);
  const pollingRef = useRef(false);

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
      const next = body.review as Review;
      setReview(next);
      const currentUrl =
        next.override?.image_url ??
        next.override?.imageUrl ??
        next.selection?.imageUrl ??
        null;
      const selected =
        next.candidates.find((c) => c.imageUrl === currentUrl)?.contentId ??
        null;
      setSelectedCandidateId(selected);
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
      setSaving(true);
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
            faceDetected: candidate?.faceLikely ?? candidate?.faceDetected,
            score: candidate?.score,
          }),
        });
        const body = await response.json();
        if (!response.ok || !body.success) {
          throw new Error(body.error ?? "保存に失敗しました。");
        }
        const next = body.review as Review;
        setReview(next);
        if (mode === "pick" && candidate) {
          setSelectedCandidateId(candidate.contentId);
          setMessage(`${review.actressName}の代表画像を変更しました`);
        } else if (mode === "clear") {
          setSelectedCandidateId(null);
          setMessage("手動設定を解除し、自動選定に戻しました。");
        } else {
          setMessage("デフォルト画像（非表示）に設定しました。");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "保存に失敗しました。");
      } finally {
        setSaving(false);
      }
    },
    [review],
  );

  const runReselectLoop = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      let current = job;
      while (true) {
        const response = await fetch("/api/admin/actress-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reselect-tick" }),
        });
        const body = await response.json();
        if (!response.ok || !body.success) {
          throw new Error(body.error ?? "再選定に失敗しました。");
        }
        current = body.job as ReselectJob;
        setJob(current);
        if (current.status !== "running") break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      setMessage(
        current?.status === "completed"
          ? `着衣優先の再選定が完了しました（更新 ${current.updated} / 変更なし ${current.unchanged} / エラー ${current.errors}）`
          : "再選定が終了しました。",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "再選定に失敗しました。");
    } finally {
      pollingRef.current = false;
    }
  }, [job]);

  const startReselect = useCallback(async () => {
    setConfirmReselect(false);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/actress-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reselect-start" }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "再選定の開始に失敗しました。");
      }
      setJob(body.job as ReselectJob);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "再選定の開始に失敗しました。",
      );
    }
  }, []);

  useEffect(() => {
    if (job?.status === "running" && !pollingRef.current) {
      void runReselectLoop();
    }
  }, [job, runReselectLoop]);

  const filteredCandidates =
    review?.candidates.filter((candidate) => {
      if (filter === "clothed") {
        return (
          candidate.clothingConfidence === "high" ||
          candidate.clothingConfidence === "medium"
        );
      }
      if (filter === "solo") return candidate.isSoloWork;
      if (filter === "face") return candidate.faceLikely || candidate.faceDetected;
      if (filter === "hd") return candidate.imageQualityLabel === "高解像度";
      if (filter === "manual") {
        return (
          selectedCandidateId === candidate.contentId ||
          candidate.imageUrl ===
            (review.override?.image_url ?? review.override?.imageUrl)
        );
      }
      return true;
    }) ?? [];

  const currentOverrideUrl =
    review?.override?.image_url ?? review?.override?.imageUrl ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold text-foreground">女優代表画像</h1>
        <p className="mt-2 text-sm text-muted">
          着衣パッケージ・単体作品・顔が写りやすい画像を優先します。手動選択は本番でも永続化され、自動再選定では上書きされません。
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
            disabled={loading || saving || !nameInput.trim()}
            onClick={() => loadReview(nameInput.trim())}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "読み込み中…" : "確認"}
          </button>
          {review ? (
            <button
              type="button"
              disabled={loading || saving}
              onClick={() => loadReview(review.actressName)}
              className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50"
              title="表示を更新します。手動設定は上書きしません。"
            >
              再選定（自動再計算）
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving || job?.status === "running"}
            onClick={() => setConfirmReselect(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
          >
            着衣優先で全女優を再選定
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
        {saving ? <p className="mt-3 text-sm text-blue-700">保存中…</p> : null}
      </section>

      {job ? (
        <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">着衣優先 全件再選定</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">対象女優数</dt>
              <dd>{job.total}</dd>
            </div>
            <div>
              <dt className="text-muted">処理済み</dt>
              <dd>{job.processed}</dd>
            </div>
            <div>
              <dt className="text-muted">更新件数</dt>
              <dd>{job.updated}</dd>
            </div>
            <div>
              <dt className="text-muted">変更なし</dt>
              <dd>{job.unchanged}</dd>
            </div>
            <div>
              <dt className="text-muted">エラー</dt>
              <dd>{job.errors}</dd>
            </div>
            <div>
              <dt className="text-muted">進捗率</dt>
              <dd>{job.progressPercent}%</dd>
            </div>
            <div>
              <dt className="text-muted">開始日時</dt>
              <dd>{job.startedAt ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">終了日時</dt>
              <dd>{job.finishedAt ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">状態</dt>
              <dd>{job.status}</dd>
            </div>
          </dl>
          {job.lastError ? (
            <p className="mt-2 text-sm text-red-600">{job.lastError}</p>
          ) : null}
        </section>
      ) : null}

      {review ? (
        <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-foreground">
            {review.actressName}（作品 {review.workCount}件）
          </h2>
          <p className="mt-1 text-xs text-muted">
            selectionVersion: {review.selectionVersion}
            {review.isManualOverride ? " / 手動設定あり" : ""}
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
                  {review.selection?.faceDetected ? "あり" : "なし"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">着衣推定</dt>
                <dd>
                  {clothingLabel(review.selection?.clothingConfidence)}
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
              disabled={saving || !selectedCandidateId}
              onClick={() => {
                const candidate = review.candidates.find(
                  (row) => row.contentId === selectedCandidateId,
                );
                if (candidate) void applyMode("pick", candidate);
              }}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {saving ? "保存中…" : "この画像を代表画像に設定"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => applyMode("default")}
              className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
            >
              デフォルトへ戻す
            </button>
            <button
              type="button"
              disabled={saving || !review.isManualOverride}
              onClick={() => applyMode("clear")}
              className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
            >
              手動設定を解除
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(
              [
                ["all", "全候補"],
                ["clothed", "着衣優先"],
                ["solo", "単体作品のみ"],
                ["face", "顔ありのみ"],
                ["hd", "高解像度のみ"],
                ["manual", "手動設定候補"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  filter === key
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-border text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <h3 className="mt-4 text-sm font-bold text-foreground">
            候補画像（総合スコア順）
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCandidates.map((candidate) => {
              const selected = selectedCandidateId === candidate.contentId;
              const isCurrent =
                candidate.imageUrl === currentOverrideUrl ||
                candidate.imageUrl === review.selection?.imageUrl;
              return (
                <article
                  key={candidate.contentId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedCandidateId(candidate.contentId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      setSelectedCandidateId(candidate.contentId);
                    }
                  }}
                  className={`overflow-hidden rounded-lg border-2 ${
                    selected
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : isCurrent
                        ? "border-red-400"
                        : "border-border"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={candidate.imageUrl}
                    alt={candidate.contentId}
                    className="h-40 w-full object-cover"
                  />
                  <div className="space-y-1 p-3 text-xs">
                    <p className="font-medium">{candidate.contentId}</p>
                    <p>総合スコア：{candidate.score}</p>
                    <p>
                      単体作品：{candidate.isSoloWork ? "はい" : "いいえ"}
                    </p>
                    <p>
                      顔検出：
                      {candidate.faceLikely || candidate.faceDetected
                        ? "あり"
                        : "なし"}
                    </p>
                    <p>顔の大きさ：{candidate.faceSizeLabel ?? "不明"}</p>
                    <p>
                      着衣推定：
                      {candidate.clothingConfidenceLabel ??
                        clothingLabel(candidate.clothingConfidence)}
                    </p>
                    <p>
                      肌露出ペナルティ：{candidate.skinExposurePenalty ?? 0}
                    </p>
                    <p>
                      複数人物ペナルティ：{candidate.multiPersonPenalty ?? 0}
                    </p>
                    <p>文字量ペナルティ：{candidate.textHeavyPenalty ?? 0}</p>
                    <p>画像品質：{candidate.imageQualityLabel ?? "標準"}</p>
                    <div className="text-muted">
                      <p className="font-medium text-foreground">選定理由：</p>
                      <ul className="mt-1 list-disc pl-4">
                        {(candidate.reasonLines ?? []).slice(0, 6).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedCandidateId(candidate.contentId);
                        void applyMode("pick", candidate);
                      }}
                      className="mt-2 rounded border border-blue-500 bg-blue-50 px-2 py-1 text-blue-700 disabled:opacity-50"
                    >
                      この画像を代表画像に設定
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {confirmReselect ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-xl bg-white p-5 shadow-lg">
            <p className="text-sm text-foreground">
              手動設定されていない女優のみ、着衣優先ロジックで代表画像を再計算します。実行しますか？
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
                onClick={() => setConfirmReselect(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white"
                onClick={() => void startReselect()}
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
