"use client";

import { useMemo, useState } from "react";
import type { OpsSuggestion } from "@/lib/admin/ops-types";

const PRIORITY_META: Record<
  OpsSuggestion["priority"],
  { label: string; className: string }
> = {
  5: { label: "高", className: "bg-red-100 text-red-800" },
  4: { label: "中", className: "bg-amber-100 text-amber-900" },
  3: { label: "低", className: "bg-zinc-100 text-zinc-700" },
};

function splitSuggestion(text: string): { title: string; summary: string } {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sentenceEnd = normalized.search(/[。．.！？!?]/);
  if (sentenceEnd > 0 && sentenceEnd < 48) {
    return {
      title: normalized.slice(0, sentenceEnd + 1),
      summary: normalized.slice(sentenceEnd + 1).trim() || normalized,
    };
  }
  if (normalized.length <= 40) {
    return { title: normalized, summary: normalized };
  }
  return {
    title: `${normalized.slice(0, 40)}…`,
    summary: normalized,
  };
}

function extractPageCount(text: string): number | null {
  const match = text.match(/(\d+)\s*件/);
  if (!match) return null;
  return Number(match[1]);
}

type SeoSuggestionListProps = {
  suggestions: OpsSuggestion[];
};

export function SeoSuggestionList({ suggestions }: SeoSuggestionListProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () =>
      [...suggestions].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)),
    [suggestions],
  );
  const visible = showAll ? sorted : sorted.slice(0, 3);
  const remaining = Math.max(0, sorted.length - 3);

  if (sorted.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
        <h2 className="text-base font-bold text-foreground">今日のSEO改善提案</h2>
        <p className="mt-2 text-sm text-muted">今日の改善提案はまだありません。</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
      <h2 className="text-base font-bold text-foreground">今日のSEO改善提案</h2>
      <ul className="mt-3 space-y-2">
        {visible.map((suggestion) => {
          const meta = PRIORITY_META[suggestion.priority];
          const { title, summary } = splitSuggestion(suggestion.text);
          const pageCount = extractPageCount(suggestion.text);
          const open = expandedId === suggestion.id;
          const done = doneIds.has(suggestion.id);

          return (
            <li
              key={suggestion.id}
              className={`rounded-xl border border-border px-3 py-3 ${
                done ? "opacity-60" : "bg-surface/30"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex min-h-7 items-center rounded-md px-2 text-xs font-bold ${meta.className}`}
                >
                  {meta.label}
                </span>
                {pageCount != null ? (
                  <span className="text-xs text-muted">対象 {pageCount}件</span>
                ) : null}
              </div>
              <p
                className={`mt-1 text-sm font-semibold text-foreground ${
                  done ? "line-through" : ""
                }`}
              >
                {title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted">{summary}</p>

              {open ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-foreground">
                  {suggestion.text}
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(open ? null : suggestion.id)
                  }
                  className="inline-flex min-h-11 items-center rounded-lg border border-border bg-white px-3 text-xs font-semibold text-accent"
                >
                  {open ? "閉じる" : "詳細を見る"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDoneIds((current) => {
                      const next = new Set(current);
                      if (next.has(suggestion.id)) next.delete(suggestion.id);
                      else next.add(suggestion.id);
                      return next;
                    })
                  }
                  className="inline-flex min-h-11 items-center rounded-lg border border-border bg-white px-3 text-xs font-semibold text-foreground"
                >
                  {done ? "未対応に戻す" : "対応済みにする"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {!showAll && remaining > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-white text-sm font-semibold text-accent"
        >
          残り{remaining}件を見る
        </button>
      ) : null}
      {showAll && sorted.length > 3 ? (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-white text-sm font-semibold text-muted"
        >
          上位3件に戻す
        </button>
      ) : null}
    </section>
  );
}
