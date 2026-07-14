"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CatalogPromoteApiResult,
  CatalogPromoteDiff,
  CatalogPromoteStatus,
  CatalogPromoteStatusPayload,
} from "@/lib/admin/catalog-promote-types";

type CatalogPromotePanelProps = {
  configured: boolean;
};

type PromoteFailureView = {
  failedStage: CatalogPromoteStatus | null;
  httpStatus: number | null;
  errorCode: string | null;
  message: string;
  retryable: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  IDLE: "待機中",
  VALIDATING: "検証中",
  MERGING: "mainへ反映中",
  DEPLOYING: "デプロイ中",
  READY: "反映済み",
  FAILED: "失敗",
};

const DEPLOY_LABEL: Record<string, string> = {
  none: "なし",
  pending: "開始待ち / Building",
  building: "Building",
  ready: "Ready",
  failed: "Failed",
  unknown: "不明（ダッシュボードで確認）",
};

const STAGE_LABEL: Record<string, string> = {
  IDLE: "開始前",
  VALIDATING: "検証",
  MERGING: "main反映",
  DEPLOYING: "デプロイ",
  READY: "完了",
  FAILED: "失敗",
};

export function CatalogPromotePanel({ configured }: CatalogPromotePanelProps) {
  const [status, setStatus] = useState<CatalogPromoteStatusPayload | null>(null);
  const [diff, setDiff] = useState<CatalogPromoteDiff | null>(null);
  const [error, setError] = useState<PromoteFailureView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [discardConfirmText, setDiscardConfirmText] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const promoteInFlight = useRef(false);

  const refreshStatus = useCallback(async (options?: { keepError?: boolean }) => {
    setLoading(true);
    if (!options?.keepError) {
      setError(null);
    }
    try {
      const response = await fetch("/api/admin/import/promote/status");
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "状態の取得に失敗しました。");
      }
      setStatus(body.status as CatalogPromoteStatusPayload);
    } catch (err) {
      if (!options?.keepError) {
        setError({
          failedStage: null,
          httpStatus: null,
          errorCode: "STATUS_FETCH_FAILED",
          message:
            err instanceof Error ? err.message : "状態の取得に失敗しました。",
          retryable: true,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const applyProgress = useCallback((next: CatalogPromoteStatus) => {
    setStatus((prev) =>
      prev
        ? {
            ...prev,
            status: next,
            deployState:
              next === "DEPLOYING" || next === "READY" ? "pending" : prev.deployState,
          }
        : prev,
    );
  }, []);

  const handleLoadDiff = useCallback(async () => {
    setError(null);
    setShowDiff(true);
    try {
      const response = await fetch("/api/admin/import/promote/diff");
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? "変更内容の取得に失敗しました。");
      }
      setDiff(body.diff as CatalogPromoteDiff);
    } catch (err) {
      setError({
        failedStage: null,
        httpStatus: null,
        errorCode: "DIFF_FAILED",
        message:
          err instanceof Error ? err.message : "変更内容の取得に失敗しました。",
        retryable: true,
      });
    }
  }, []);

  const handlePromote = useCallback(async () => {
    if (promoteInFlight.current) return;
    promoteInFlight.current = true;
    setPromoting(true);
    setError(null);
    setMessage(null);
    applyProgress("VALIDATING");

    try {
      const response = await fetch("/api/admin/import/promote", {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson, application/json",
        },
      });

      const contentType = response.headers.get("content-type") ?? "";
      let result: CatalogPromoteApiResult | null = null;

      if (contentType.includes("application/x-ndjson")) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("本番反映レスポンスの読み取りに失敗しました。");
        }
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const event = JSON.parse(trimmed) as {
              type?: string;
              status?: CatalogPromoteStatus;
            } & Partial<CatalogPromoteApiResult>;
            if (event.type === "progress" && event.status) {
              applyProgress(event.status);
            } else if (event.type === "result") {
              result = event as CatalogPromoteApiResult;
            }
          }
        }
        if (buffer.trim()) {
          const event = JSON.parse(buffer.trim()) as {
            type?: string;
          } & Partial<CatalogPromoteApiResult>;
          if (event.type === "result") {
            result = event as CatalogPromoteApiResult;
          }
        }
      } else {
        const body = (await response.json()) as CatalogPromoteApiResult & {
          error?: string;
        };
        result = {
          ...body,
          ok: body.ok ?? body.success ?? response.ok,
          httpStatus: body.httpStatus ?? response.status,
        };
      }

      if (!result) {
        throw new Error("本番反映APIから結果を取得できませんでした。");
      }

      if (!result.ok) {
        setError({
          failedStage: result.failedStage ?? "FAILED",
          httpStatus: result.httpStatus ?? response.status,
          errorCode: result.errorCode ?? "PROMOTE_FAILED",
          message: result.message || "本番反映に失敗しました。",
          retryable: Boolean(result.retryable),
        });
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                status: "FAILED",
                errorSummary: result.message,
                errorCode: result.errorCode,
                failedStage: result.failedStage,
                httpStatus: result.httpStatus,
                retryable: result.retryable,
                deployState: "failed",
              }
            : prev,
        );
        // 失敗詳細を消さないよう keepError
        await refreshStatus({ keepError: true });
        return;
      }

      setMessage(result.message ?? "本番反映が完了しました。");
      if (result.statusPayload) {
        setStatus({
          ...result.statusPayload,
          status: "READY",
          lastPromoteSha:
            result.mergedMainSha ?? result.statusPayload.lastPromoteSha,
          lastPromoteAt:
            result.lastPromoteAt ?? result.statusPayload.lastPromoteAt,
          productionUrl:
            result.productionUrl ?? result.statusPayload.productionUrl,
          deployState:
            result.deployState ?? result.statusPayload.deployState ?? "pending",
          hasPendingChanges: false,
        });
      } else {
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                status: "READY",
                lastPromoteSha: result.mergedMainSha,
                lastPromoteAt: result.lastPromoteAt,
                productionUrl: result.productionUrl,
                deployState: result.deployState ?? "pending",
                hasPendingChanges: false,
                errorSummary: null,
                errorCode: null,
                failedStage: null,
              }
            : prev,
        );
        await refreshStatus({ keepError: true });
      }
      setShowPromoteConfirm(false);
      setDiff(null);
    } catch (err) {
      setError({
        failedStage: status?.status ?? "VALIDATING",
        httpStatus: null,
        errorCode: "CLIENT_ERROR",
        message:
          err instanceof Error ? err.message : "本番反映に失敗しました。",
        retryable: true,
      });
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              status: "FAILED",
              deployState: "failed",
              errorSummary:
                err instanceof Error ? err.message : "本番反映に失敗しました。",
            }
          : prev,
      );
      await refreshStatus({ keepError: true });
    } finally {
      promoteInFlight.current = false;
      setPromoting(false);
    }
  }, [applyProgress, refreshStatus, status?.status]);

  const handleDiscard = useCallback(async () => {
    setPromoting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/import/promote/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: discardConfirmText }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? body.message ?? "破棄に失敗しました。");
      }
      setMessage(body.message ?? "作業内容を破棄しました。");
      if (body.status) {
        setStatus(body.status as CatalogPromoteStatusPayload);
      } else {
        await refreshStatus();
      }
      setShowDiscardConfirm(false);
      setDiscardConfirmText("");
      setDiff(null);
    } catch (err) {
      setError({
        failedStage: null,
        httpStatus: null,
        errorCode: "DISCARD_FAILED",
        message: err instanceof Error ? err.message : "破棄に失敗しました。",
        retryable: true,
      });
    } finally {
      setPromoting(false);
    }
  }, [discardConfirmText, refreshStatus]);

  const busy =
    promoting ||
    status?.status === "VALIDATING" ||
    status?.status === "MERGING" ||
    status?.status === "DEPLOYING";

  const canPromote =
    configured &&
    Boolean(status?.hasPendingChanges) &&
    !busy &&
    status?.configured !== false;

  return (
    <section className="rounded-xl border border-amber-500/40 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">本番反映・デプロイ</h2>
          <p className="mt-1 text-sm text-muted">
            作業用ブランチの変更をまとめ、main へ1回反映して Production デプロイを1回だけ実行します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshStatus()}
          disabled={loading || busy}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-background disabled:opacity-50"
        >
          状態を再取得
        </button>
      </div>

      {status?.message ? (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            status.hasPendingChanges
              ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
              : "bg-emerald-500/10 text-foreground"
          }`}
        >
          {status.message}
        </p>
      ) : null}

      {error ? (
        <div className="mt-3 space-y-1 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700">
          <p className="font-medium">本番反映に失敗しました</p>
          <p>失敗した段階: {STAGE_LABEL[error.failedStage ?? "FAILED"] ?? error.failedStage ?? "—"}</p>
          <p>HTTPステータス: {error.httpStatus ?? "—"}</p>
          <p>エラーコード: {error.errorCode ?? "—"}</p>
          <p>メッセージ: {error.message}</p>
          <p>再試行: {error.retryable ? "可能" : "不可（内容を確認してください）"}</p>
        </div>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-foreground">
          {message}
        </p>
      ) : null}

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-muted">未反映の変更</dt>
          <dd className="font-medium text-foreground">
            {status?.hasPendingChanges ? "あり" : "なし"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">作業用ブランチ</dt>
          <dd className="font-medium text-foreground">
            {status?.workingBranch ?? "未設定"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Productionブランチ</dt>
          <dd className="font-medium text-foreground">
            {status?.productionBranch ?? "main"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">未反映コミット数</dt>
          <dd className="font-medium text-foreground">
            {(status?.pendingCommitCount ?? 0).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted">変更ファイル数</dt>
          <dd className="font-medium text-foreground">
            {(status?.changedFileCount ?? 0).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted">追加作品数（概算）</dt>
          <dd className="font-medium text-foreground">
            {(status?.addedWorkCount ?? 0).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted">更新作品数</dt>
          <dd className="font-medium text-foreground">
            {(status?.updatedWorkCount ?? 0).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted">最終作業日時</dt>
          <dd className="font-medium text-foreground">
            {status?.lastWorkAt
              ? new Date(status.lastWorkAt).toLocaleString("ja-JP")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">最後に本番反映した日時</dt>
          <dd className="font-medium text-foreground">
            {status?.lastPromoteAt
              ? new Date(status.lastPromoteAt).toLocaleString("ja-JP")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">現在のデプロイ状態</dt>
          <dd className="font-medium text-foreground">
            {STATUS_LABEL[status?.status ?? "IDLE"] ?? status?.status} /{" "}
            {DEPLOY_LABEL[status?.deployState ?? "none"] ?? status?.deployState}
          </dd>
        </div>
        <div>
          <dt className="text-muted">反映コミット SHA</dt>
          <dd className="font-mono text-xs text-foreground">
            {status?.lastPromoteSha?.slice(0, 12) ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Production URL</dt>
          <dd className="font-medium text-foreground">
            {status?.productionUrl ? (
              <a
                href={status.productionUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {status.productionUrl}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      {status?.errorSummary && !error ? (
        <p className="mt-3 text-sm text-red-700">
          失敗概要: {status.errorSummary}
          {status.errorCode ? ` (${status.errorCode})` : ""}
          {status.failedStage
            ? ` / 段階: ${STAGE_LABEL[status.failedStage] ?? status.failedStage}`
            : ""}
          {status.httpStatus ? ` / HTTP ${status.httpStatus}` : ""}
        </p>
      ) : null}

      {!status?.configured ? (
        <p className="mt-3 text-sm text-muted">
          本番反映には GitHub 認証と ADULT_CATALOG_WORKING_BRANCH（例: catalog-staging）の設定が必要です。
          ローカル書き込みモードでは作業用ブランチへの保存・本番反映は行われません。
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canPromote}
          onClick={() => setShowPromoteConfirm(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          title={
            !status?.hasPendingChanges
              ? "未反映の変更がないため実行できません"
              : busy
                ? "処理中です"
                : undefined
          }
        >
          本番反映・デプロイ
        </button>
        <button
          type="button"
          disabled={!status?.configured || busy}
          onClick={() => void handleLoadDiff()}
          className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-background disabled:opacity-50"
        >
          変更内容を確認
        </button>
        <button
          type="button"
          disabled={!status?.hasPendingChanges || busy}
          onClick={() => setShowDiscardConfirm(true)}
          className="rounded-md border border-red-400/50 px-3 py-2 text-sm text-red-700 hover:bg-red-500/10 disabled:opacity-50"
        >
          作業内容を破棄
        </button>
      </div>

      {showPromoteConfirm ? (
        <div className="mt-4 rounded-lg border border-border bg-background p-4 text-sm">
          <p className="font-medium text-foreground">本番サイトへ反映しますか？</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>追加作品：{(status?.addedWorkCount ?? 0).toLocaleString()}件</li>
            <li>更新作品：{(status?.updatedWorkCount ?? 0).toLocaleString()}件</li>
            <li>変更ファイル：{(status?.changedFileCount ?? 0).toLocaleString()}件</li>
            <li>未反映コミット：{(status?.pendingCommitCount ?? 0).toLocaleString()}件</li>
          </ul>
          <p className="mt-2 text-muted">
            この操作により、mainへ変更が反映され、Vercel Productionデプロイが1回実行されます。
          </p>
          {promoting ? (
            <p className="mt-2 font-medium text-foreground">
              進行状況: {STATUS_LABEL[status?.status ?? "VALIDATING"] ?? status?.status}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={promoting}
              onClick={() => setShowPromoteConfirm(false)}
              className="rounded-md border border-border px-3 py-1.5"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={promoting}
              onClick={() => void handlePromote()}
              className="rounded-md bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50"
            >
              {promoting
                ? `${STATUS_LABEL[status?.status ?? "VALIDATING"] ?? "反映中"}…`
                : "検証して本番反映"}
            </button>
          </div>
        </div>
      ) : null}

      {showDiscardConfirm ? (
        <div className="mt-4 rounded-lg border border-red-400/40 bg-background p-4 text-sm">
          <p className="font-medium text-foreground">
            作業用ブランチの未反映変更を破棄しますか？
          </p>
          <p className="mt-1 text-muted">
            catalog-staging を現在の main 状態へ戻します。main と Production
            デプロイは変更しません。
          </p>
          <label className="mt-3 block">
            <span className="text-muted">
              確認のため「未反映の変更を破棄」と入力
            </span>
            <input
              value={discardConfirmText}
              onChange={(e) => setDiscardConfirmText(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowDiscardConfirm(false);
                setDiscardConfirmText("");
              }}
              className="rounded-md border border-border px-3 py-1.5"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={
                promoting || discardConfirmText !== "未反映の変更を破棄"
              }
              onClick={() => void handleDiscard()}
              className="rounded-md bg-red-600 px-3 py-1.5 text-white disabled:opacity-50"
            >
              破棄する
            </button>
          </div>
        </div>
      ) : null}

      {showDiff && diff ? (
        <div className="mt-4 max-h-[28rem] overflow-auto rounded-lg border border-border bg-background p-4 text-sm">
          <p className="font-medium text-foreground">変更内容</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>
              追加：{diff.addedCount.toLocaleString()}件 / 更新：
              {diff.updatedCount.toLocaleString()}件 / 削除：
              {diff.removedCount.toLocaleString()}件
              {diff.truncated ? "（一覧は最大100件）" : ""}
            </li>
            <li>カタログシャード：{diff.changedCatalogShards.join(", ") || "なし"}</li>
            <li>メディアシャード：{diff.changedMediaShards.join(", ") || "なし"}</li>
            <li>サイトマップ変更：{diff.sitemapChanged ? "あり" : "なし"}</li>
            <li>検索インデックス変更：{diff.searchIndexChanged ? "あり" : "なし"}</li>
          </ul>
          <p className="mt-3 font-medium text-foreground">変更ファイル</p>
          <ul className="mt-1 list-inside list-disc text-muted">
            {diff.changedFiles.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
          {diff.addedWorks.length > 0 ? (
            <>
              <p className="mt-3 font-medium text-foreground">追加作品</p>
              <ul className="mt-1 space-y-1 text-muted">
                {diff.addedWorks.map((work) => (
                  <li key={`a-${work.contentId}`}>
                    {work.title || work.contentId}（{work.contentId}）
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {diff.updatedWorks.length > 0 ? (
            <>
              <p className="mt-3 font-medium text-foreground">更新作品</p>
              <ul className="mt-1 space-y-1 text-muted">
                {diff.updatedWorks.map((work) => (
                  <li key={`u-${work.contentId}`}>
                    {work.title || work.contentId}（{work.contentId}）
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {diff.removedWorks.length > 0 ? (
            <>
              <p className="mt-3 font-medium text-foreground">削除作品</p>
              <ul className="mt-1 space-y-1 text-muted">
                {diff.removedWorks.map((work) => (
                  <li key={`r-${work.contentId}`}>
                    {work.title || work.contentId}（{work.contentId}）
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
