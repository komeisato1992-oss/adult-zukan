"use client";

import { useId, useState, type ReactNode } from "react";

type CompareDescriptionReadMoreProps = {
  children: ReactNode;
  lines?: 2 | 3;
  className?: string;
};

/** 作品説明の折りたたみ専用。ページ全体を Client 化しないための小さなコンポーネント */
export function CompareDescriptionReadMore({
  children,
  lines = 3,
  className = "",
}: CompareDescriptionReadMoreProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const clampClass = lines === 2 ? "line-clamp-2" : "line-clamp-3";

  return (
    <div className={className}>
      <div
        id={contentId}
        className={
          expanded
            ? "text-sm leading-relaxed text-foreground break-words"
            : `${clampClass} overflow-hidden text-sm leading-relaxed text-foreground break-words`
        }
      >
        {children}
      </div>
      <button
        type="button"
        className="mt-1.5 text-xs font-medium text-accent hover:underline"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? "閉じる" : "続きを読む"}
      </button>
    </div>
  );
}
