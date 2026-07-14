"use client";

import { useId, useState, type ReactNode } from "react";

type WorkDescriptionReadMoreProps = {
  children: ReactNode;
  lines?: 2 | 3;
  className?: string;
  /** 見出しテキスト（モバイル用）。PCでは非表示にしてテーブル側の説明を使う場合あり */
  heading?: string;
  headingId?: string;
};

/**
 * 作品説明の折りたたみ。
 * - ≤768px: 初期3行 + 続きを読む
 * - ≥769px: 常に全文（ボタン非表示）※PC表と併用しない場合に使う
 */
export function WorkDescriptionReadMore({
  children,
  lines = 3,
  className = "",
  heading,
  headingId,
}: WorkDescriptionReadMoreProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const clampClass = lines === 2 ? "line-clamp-2" : "line-clamp-3";

  return (
    <section
      aria-labelledby={heading && headingId ? headingId : undefined}
      className={className}
    >
      {heading && headingId ? (
        <h2
          id={headingId}
          className="mb-3 border-l-4 border-accent pl-3 text-[17px] font-bold text-foreground"
        >
          {heading}
        </h2>
      ) : null}
      <div
        id={contentId}
        className={
          expanded
            ? "whitespace-pre-wrap text-[15px] leading-relaxed text-foreground break-words"
            : `${clampClass} overflow-hidden whitespace-pre-wrap text-[15px] leading-relaxed text-foreground break-words`
        }
      >
        {children}
      </div>
      <button
        type="button"
        className="mt-2 text-[13px] font-medium text-accent hover:underline"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? "閉じる" : "続きを読む"}
      </button>
    </section>
  );
}
