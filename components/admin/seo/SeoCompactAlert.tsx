"use client";

import { useState } from "react";

type SeoCompactAlertProps = {
  message: string;
  details?: string;
  onRetry?: () => void;
  onOpenDevInfo?: () => void;
  staleNotice?: string;
};

export function SeoCompactAlert({
  message,
  details,
  onRetry,
  onOpenDevInfo,
  staleNotice,
}: SeoCompactAlertProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      {staleNotice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {staleNotice}
        </div>
      ) : null}
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <p>{message}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {details ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="text-accent underline"
            >
              {expanded ? "詳細を閉じる" : "詳細を見る"}
            </button>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="text-accent underline"
            >
              再接続を確認
            </button>
          ) : null}
          {onOpenDevInfo ? (
            <button
              type="button"
              onClick={onOpenDevInfo}
              className="text-accent underline"
            >
              開発者情報を開く
            </button>
          ) : null}
        </div>
        {expanded && details ? (
          <pre className="mt-3 whitespace-pre-wrap rounded bg-white/80 p-3 text-xs">
            {details}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

export function SeoUnconfiguredNotice() {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
      <p className="font-medium text-foreground">
        Search Console APIに接続できません。
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1">
        <li>Search Console APIが有効か</li>
        <li>サービスアカウントがSearch Consoleに追加されているか</li>
        <li>GSC_SITE_URLが一致しているか</li>
      </ul>
    </div>
  );
}
