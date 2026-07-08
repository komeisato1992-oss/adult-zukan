"use client";

import { useState } from "react";

type ImportGeneratedPostProps = {
  typeLabel: string;
  body: string;
};

function buildTweetIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function getCharCountClass(length: number): string {
  if (length >= 281) return "font-semibold text-red-600";
  if (length >= 261) return "text-amber-600";
  return "text-muted";
}

export function ImportGeneratedPost({ typeLabel, body }: ImportGeneratedPostProps) {
  const [copied, setCopied] = useState(false);
  const charCount = body.length;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted">生成された投稿文</p>
      <p className="mt-1 text-sm font-bold text-foreground">{typeLabel}</p>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {body}
      </p>

      <p className={`mt-3 text-xs ${getCharCountClass(charCount)}`}>
        {charCount}文字
        {charCount >= 281
          ? "（280文字超過）"
          : charCount >= 261
            ? "（280文字に近い）"
            : null}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          {copied ? "コピーしました" : "コピー"}
        </button>
        <a
          href={buildTweetIntentUrl(body)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Xで開く
        </a>
      </div>
    </div>
  );
}
