"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DoujinCircleLinks } from "@/components/doujin/DoujinCircleLinks";
import {
  clearDoujinHistory,
  getDoujinHistory,
  type DoujinStoredWork,
} from "@/lib/doujin/history";

export function DoujinHistoryClient() {
  const [items, setItems] = useState<DoujinStoredWork[]>([]);

  useEffect(() => {
    setItems(getDoujinHistory());
  }, []);

  if (items.length === 0) {
    return (
      <div className="rounded border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">閲覧履歴はまだありません。</p>
        <Link
          href="/doujin/works"
          className="mt-4 inline-flex rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
        >
          作品一覧へ
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            clearDoujinHistory();
            setItems([]);
          }}
          className="text-sm text-accent hover:underline"
        >
          履歴をクリア
        </button>
      </div>
      <ul className="divide-y divide-border rounded border border-border bg-white">
        {items.map((item) => (
          <li key={`${item.id}-${item.viewedAt}`} className="px-4 py-3">
            <Link
              href={`/doujin/works/${item.id}`}
              className="text-sm font-medium text-foreground hover:text-accent"
            >
              {item.title}
            </Link>
            <DoujinCircleLinks
              circleId={item.circleId}
              circleName={item.circleName}
              className="mt-1 text-xs text-muted"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
