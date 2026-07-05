"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { clearHistory, getHistory, type StoredWork } from "@/lib/client-storage";

export function HistoryClient() {
  const [history, setHistory] = useState<StoredWork[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  function handleClear() {
    clearHistory();
    setHistory([]);
  }

  return (
    <PageLayout showSidebar={false}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "閲覧履歴" },
        ]}
      />
      <header className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
            閲覧履歴
          </h1>
          <p className="mt-3 text-sm text-muted">
            最近閲覧した作品の履歴です。データはブラウザのLocalStorageに保存されます（最大20件）。
          </p>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded border border-border px-4 py-2 text-xs text-muted hover:border-accent hover:text-accent"
          >
            履歴をクリア
          </button>
        )}
      </header>

      {history.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {history.map((item) => (
            <li key={`${item.slug}-${item.viewedAt}`}>
              <Link
                href={`/works/${item.slug}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted">{item.productCode}</p>
                </div>
                <time className="text-xs text-muted">
                  {new Date(item.viewedAt).toLocaleDateString("ja-JP")}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
          閲覧履歴はありません。作品ページを閲覧すると、ここに表示されます。
        </p>
      )}
    </PageLayout>
  );
}
