"use client";

import { useEffect, useRef, useState } from "react";

type DoujinAuthorCommentProps = {
  text: string;
};

/** おおよそ PC 8〜10行 / スマホ 6〜8行相当 */
const LONG_COMMENT_CHARS = 280;

/**
 * 作品詳細上部の作者コメント。
 * 長文のみ「続きを読む / 閉じる」。短い場合はボタン非表示。
 */
export function DoujinAuthorComment({ text }: DoujinAuthorCommentProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(
    () => text.trim().length > LONG_COMMENT_CHARS,
  );

  useEffect(() => {
    setExpanded(false);
    setNeedsToggle(text.trim().length > LONG_COMMENT_CHARS);
  }, [text]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return;

    const measure = () => {
      if (el.scrollHeight > el.clientHeight + 2) {
        setNeedsToggle(true);
      }
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text, expanded]);

  if (!text.trim()) return null;

  return (
    <section
      aria-label="作者コメント"
      className="mt-4 w-full rounded-lg border-l-4 border-accent bg-[var(--doujin-primary-light,#fff0f4)] px-4 py-4 sm:px-5 sm:py-5"
    >
      <h3 className="text-sm font-bold text-foreground sm:text-base">
        作者コメント
      </h3>
      <div
        ref={bodyRef}
        className={`mt-2 text-sm leading-[1.8] text-foreground sm:text-base whitespace-pre-wrap [overflow-wrap:anywhere] ${
          expanded ? "" : "line-clamp-6 md:line-clamp-9"
        }`}
      >
        {text}
      </div>
      {needsToggle || expanded ? (
        <button
          type="button"
          className="mt-3 text-sm font-medium text-accent hover:underline"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "閉じる" : "続きを読む"}
        </button>
      ) : null}
    </section>
  );
}
