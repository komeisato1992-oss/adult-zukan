"use client";

import Link from "next/link";
import { useState } from "react";
import { getActressDetailPath } from "@/lib/actresses/slug";

type DmmActressCompactLinksProps = {
  names: string[];
  className?: string;
};

/**
 * 主要情報カード向けのコンパクト女優表示。
 * 初期は1名＋「+○名」。展開で全員表示。
 */
export function DmmActressCompactLinks({
  names,
  className = "",
}: DmmActressCompactLinksProps) {
  const [expanded, setExpanded] = useState(false);

  if (names.length === 0) return null;

  if (names.length === 1) {
    return (
      <Link
        href={getActressDetailPath(names[0]!)}
        className={`text-accent hover:underline ${className}`.trim()}
      >
        {names[0]}
      </Link>
    );
  }

  const previewCount = 1;
  const restCount = names.length - previewCount;

  if (expanded) {
    return (
      <div className={className}>
        <span>
          {names.map((name, index) => (
            <span key={name}>
              {index > 0 && "、"}
              <Link
                href={getActressDetailPath(name)}
                className="text-accent hover:underline"
              >
                {name}
              </Link>
            </span>
          ))}
        </span>
        <button
          type="button"
          className="mt-1 block text-[12px] font-medium text-accent hover:underline"
          aria-expanded={true}
          onClick={() => setExpanded(false)}
        >
          閉じる
        </button>
      </div>
    );
  }

  const preview = names[0]!;

  return (
    <span className={`inline-flex min-w-0 flex-wrap items-baseline gap-x-1 ${className}`.trim()}>
      <Link
        href={getActressDetailPath(preview)}
        className="min-w-0 truncate text-accent hover:underline"
      >
        {preview}
      </Link>
      {restCount > 0 ? (
        <button
          type="button"
          className="shrink-0 text-[12px] font-semibold text-accent hover:underline"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          +{restCount}名
        </button>
      ) : null}
    </span>
  );
}
