"use client";

import { useState } from "react";
import { SnsCompareImagePreview } from "@/components/admin/SnsCompareImagePreview";
import type { SnsPostHistoryEntry } from "@/lib/admin/sns-post-history-types";
import type { SnsScheduledPost } from "@/lib/admin/sns-types";

type SnsPostCardProps = {
  post: SnsScheduledPost;
  onPosted?: (entry: SnsPostHistoryEntry) => void;
};

function buildTweetIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function getCharCountClass(length: number): string {
  if (length >= 281) return "font-semibold text-red-600";
  if (length >= 261) return "text-amber-600";
  return "text-muted";
}

const actionButtonClassName =
  "inline-flex h-11 min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-lg px-3 text-sm sm:flex-none";

export function SnsPostCard({ post: initialPost, onPosted }: SnsPostCardProps) {
  const [post, setPost] = useState(initialPost);
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isMarkingPosted, setIsMarkingPosted] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [markPostedError, setMarkPostedError] = useState<string | null>(null);
  const [markedPosted, setMarkedPosted] = useState(false);
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

  async function handleRegenerate() {
    setIsRegenerating(true);
    setRegenerateError(null);

    try {
      const response = await fetch("/api/admin/sns/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: post.type,
          meta: post.meta,
        }),
      });

      const payload = (await response.json()) as Partial<SnsScheduledPost> & {
        error?: string;
      };

      if (!response.ok) {
        setRegenerateError(payload.error ?? "別案の更新に失敗しました。");
        return;
      }

      setPost((current) => ({
        ...current,
        body: payload.body ?? current.body,
        compareWorks:
          post.type === "compare" ? payload.compareWorks : undefined,
        compareUrl: post.type === "compare" ? payload.compareUrl : undefined,
        meta: payload.meta ?? current.meta,
      }));
      setMarkedPosted(false);
    } catch {
      setRegenerateError("別案の更新に失敗しました。");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleMarkPosted() {
    setIsMarkingPosted(true);
    setMarkPostedError(null);

    try {
      const response = await fetch("/api/admin/sns/mark-posted", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postType: post.type,
          meta: post.meta,
          postText: post.body,
          postUrl: post.compareUrl,
        }),
      });

      const payload = (await response.json()) as {
        entry?: SnsPostHistoryEntry;
        error?: string;
      };

      if (!response.ok) {
        setMarkPostedError(payload.error ?? "投稿済みの記録に失敗しました。");
        return;
      }

      if (payload.entry) {
        onPosted?.(payload.entry);
      }
      setMarkedPosted(true);
    } catch {
      setMarkPostedError("投稿済みの記録に失敗しました。");
    } finally {
      setIsMarkingPosted(false);
    }
  }

  return (
    <article className="w-full max-w-full overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">投稿タイプ</p>
          <h3 className="mt-1 break-words text-base font-bold text-foreground">
            {post.typeLabel}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent">
          {post.slot}
        </span>
      </div>

      <div className="mt-4 max-w-full overflow-hidden whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
        {post.body}
      </div>

      <p className={`mt-3 text-xs ${getCharCountClass(charCount)}`}>
        {charCount}文字
        {charCount >= 281
          ? "（280文字超過）"
          : charCount >= 261
            ? "（280文字に近い）"
            : null}
      </p>

      {post.compareWorks && post.compareUrl ? (
        <div className="mt-5 max-w-full space-y-4 overflow-hidden rounded-lg border border-border bg-surface p-3 sm:p-4">
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
              className="break-all text-accent hover:underline"
            >
              {post.compareUrl}
            </a>
          </p>
        </div>
      ) : null}

      {regenerateError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {regenerateError}
        </p>
      ) : null}

      {markPostedError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {markPostedError}
        </p>
      ) : null}

      {markedPosted ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          投稿履歴に記録しました。
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className={`${actionButtonClassName} border border-border text-foreground transition-colors hover:border-accent hover:text-accent`}
        >
          {copied ? "コピーしました" : "コピー"}
        </button>
        <a
          href={buildTweetIntentUrl(post.body)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${actionButtonClassName} bg-accent font-medium text-white transition-colors hover:bg-accent-hover`}
        >
          Xで開く
        </a>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className={`${actionButtonClassName} border border-border bg-white text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isRegenerating ? "更新中..." : "別案に更新"}
        </button>
        <button
          type="button"
          onClick={handleMarkPosted}
          disabled={isMarkingPosted || markedPosted}
          className={`${actionButtonClassName} border border-emerald-300 bg-emerald-50 text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isMarkingPosted
            ? "記録中..."
            : markedPosted
              ? "投稿済み"
              : "投稿済みにする"}
        </button>
      </div>
    </article>
  );
}
