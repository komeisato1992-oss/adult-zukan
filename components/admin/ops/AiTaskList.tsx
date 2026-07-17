"use client";

import { useMemo, useState } from "react";
import type { OpsTask, OpsTaskBucket } from "@/lib/admin/ops-types";

const BUCKET_META: Record<
  OpsTaskBucket,
  { label: string; priority: string; className: string }
> = {
  urgent: {
    label: "最優先",
    priority: "高",
    className: "bg-red-100 text-red-800",
  },
  this_week: {
    label: "今週対応",
    priority: "中",
    className: "bg-amber-100 text-amber-900",
  },
  backlog: {
    label: "余裕があれば",
    priority: "低",
    className: "bg-zinc-100 text-zinc-700",
  },
};

function splitTask(text: string): { title: string; description: string } {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 36) {
    return { title: normalized, description: "" };
  }
  return {
    title: `${normalized.slice(0, 36)}…`,
    description: normalized,
  };
}

type AiTaskListProps = {
  tasks: OpsTask[];
  onCompleteTask: (id: string) => void;
};

export function AiTaskList({ tasks, onCompleteTask }: AiTaskListProps) {
  const [expanded, setExpanded] = useState(false);

  const incomplete = useMemo(
    () => tasks.filter((task) => !task.completed),
    [tasks],
  );
  const ordered = useMemo(() => {
    const rank: Record<OpsTaskBucket, number> = {
      urgent: 0,
      this_week: 1,
      backlog: 2,
    };
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return rank[a.bucket] - rank[b.bucket];
    });
  }, [tasks]);

  const topTask = ordered.find((task) => !task.completed) ?? ordered[0] ?? null;
  const visible = expanded ? ordered : topTask ? [topTask] : [];

  return (
    <section className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-foreground">AIタスク</h2>
        <p className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-foreground">
          未完了 {incomplete.length}件
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-muted">表示するタスクはありません。</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((task) => {
            const meta = BUCKET_META[task.bucket];
            const { title, description } = splitTask(task.text);
            return (
              <li
                key={task.id}
                className="rounded-xl border border-border px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex min-h-7 items-center rounded-md px-2 text-xs font-bold ${meta.className}`}
                  >
                    {meta.priority}
                  </span>
                  <span className="text-xs text-muted">{meta.label}</span>
                  <span className="text-xs font-semibold text-foreground">
                    {task.completed ? "完了" : "未完了"}
                  </span>
                </div>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    task.completed
                      ? "text-muted line-through"
                      : "text-foreground"
                  }`}
                >
                  {title}
                </p>
                {description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                    {description}
                  </p>
                ) : null}
                {!task.completed ? (
                  <button
                    type="button"
                    onClick={() => onCompleteTask(task.id)}
                    className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-accent px-3 text-xs font-semibold text-white"
                  >
                    対応済みにする
                  </button>
                ) : (
                  <p className="mt-2 text-xs text-green-700">完了済み</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!expanded && ordered.length > 1 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-white text-sm font-semibold text-accent"
        >
          すべて見る（{ordered.length}件）
        </button>
      ) : null}
      {expanded && ordered.length > 1 ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-white text-sm font-semibold text-muted"
        >
          閉じる
        </button>
      ) : null}
    </section>
  );
}
