"use client";

import { useState } from "react";
import { SnsCompareImagePreview } from "@/components/admin/SnsCompareImagePreview";
import type { SnsScheduledPost } from "@/lib/admin/sns-types";

type SnsPostCardProps = {
  post: SnsScheduledPost;
};

function buildTweetIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function getCharCountClass(length: number): string {
  if (length >= 281) return "font-semibold text-red-600";
  if (length >= 261) return "text-amber-600";
  return "text-muted";
}

export function SnsPostCard({ post }: SnsPostCardProps) {
  const [copied, setCopied] = useState(false);
  const charCount = post.body.length;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(post.body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted">投稿タイプ</p>
          <h3 className="mt-1 text-base font-bold text-foreground">{post.typeLabel}</h3>
        </div>
        <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent">
          {post.slot}
        </span>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {post.body}
      </p>

      <p className={`mt-3 text-xs ${getCharCountClass(charCount)}`}>
        {charCount}文字
        {charCount >= 281
          ? "（280文字超過）"
          : charCount >= 261
            ? "（280文字に近い）"
            : null}
      </p>

      {post.compareWorks && post.compareUrl ? (
        <div className="mt-5 space-y-4 rounded-lg border border-border bg-surface p-4">
          <SnsCompareImagePreview
            works={post.compareWorks}
            compareUrl={post.compareUrl}
          />
          <p className="break-all text-xs text-muted">
            比較URL：
            <a
              href={post.compareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {post.compareUrl}
            </a>
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          {copied ? "コピーしました" : "コピー"}
        </button>
        <a
          href={buildTweetIntentUrl(post.body)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Xで開く
        </a>
      </div>
    </article>
  );
}
