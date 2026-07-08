"use client";

import { useState } from "react";

type TodayTask = {
  id: string;
  label: string;
  checked: boolean;
};

const DEFAULT_TASKS: TodayTask[] = [
  { id: "x-post", label: "X投稿", checked: false },
  { id: "data-check", label: "データ確認", checked: false },
  { id: "seo-check", label: "SEO確認", checked: false },
];

export function TodayTasksCard() {
  const [tasks, setTasks] = useState<TodayTask[]>(DEFAULT_TASKS);

  function toggleTask(id: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, checked: !task.checked } : task,
      ),
    );
  }

  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-foreground">今日のタスク</h2>
      <ul className="mt-4 space-y-3">
        {tasks.map((task) => (
          <li key={task.id}>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={task.checked}
                onChange={() => toggleTask(task.id)}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              />
              {task.label}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
