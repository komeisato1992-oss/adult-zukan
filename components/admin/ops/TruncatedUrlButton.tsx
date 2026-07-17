"use client";

import { useState } from "react";

type TruncatedUrlButtonProps = {
  url: string;
  className?: string;
};

export function TruncatedUrlButton({
  url,
  className = "",
}: TruncatedUrlButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setExpanded(true);
    }
  }

  return (
    <div className={`min-w-0 ${className}`}>
      {!expanded ? (
        <>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="block w-full min-h-11 truncate text-left text-sm font-medium text-foreground"
            title={url}
          >
            {url}
          </button>
          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex min-h-9 items-center text-xs font-semibold text-accent"
            >
              全文表示
            </button>
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="inline-flex min-h-9 items-center text-xs font-semibold text-muted"
            >
              {copied ? "コピー済み" : "コピー"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="break-all text-sm font-medium text-foreground">{url}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="inline-flex min-h-11 items-center rounded-lg border border-border bg-white px-3 text-xs font-semibold text-accent"
            >
              {copied ? "コピー済み" : "URLをコピー"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex min-h-11 items-center rounded-lg border border-border bg-white px-3 text-xs font-semibold text-muted"
            >
              閉じる
            </button>
          </div>
        </>
      )}
    </div>
  );
}
