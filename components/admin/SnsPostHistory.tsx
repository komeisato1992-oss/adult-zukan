"use client";

import type { SnsPostHistoryEntry } from "@/lib/admin/sns-post-history-types";
import {
  getHistoryTargetLabel,
  getPostReusability,
  getPostTypeLabel,
} from "@/lib/admin/sns-post-history-display";

type SnsPostHistoryProps = {
  entries: SnsPostHistoryEntry[];
};

function formatPostedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(text: string, maxLength = 80): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

export function SnsPostHistory({ entries }: SnsPostHistoryProps) {
  if (entries.length === 0) {
    return (
      <section className="w-full max-w-full space-y-4 overflow-x-hidden">
        <h2 className="text-lg font-bold text-foreground">投稿履歴</h2>
        <p className="rounded-xl border border-border bg-white px-4 py-6 text-sm text-muted">
          まだ投稿履歴はありません。「投稿済みにする」で記録されます。
        </p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-full space-y-4 overflow-x-hidden">
      <h2 className="text-lg font-bold text-foreground">投稿履歴</h2>
      <div className="w-full max-w-full overflow-x-auto rounded-xl border border-border bg-white">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="border-b border-border bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-3 font-medium sm:px-4">投稿日時</th>
              <th className="px-3 py-3 font-medium sm:px-4">投稿タイプ</th>
              <th className="px-3 py-3 font-medium sm:px-4">対象</th>
              <th className="px-3 py-3 font-medium sm:px-4">投稿文</th>
              <th className="px-3 py-3 font-medium sm:px-4">再利用可否</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => {
              const reusability = getPostReusability(entry);
              return (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-3 text-foreground sm:px-4">
                    {formatPostedAt(entry.postedAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-foreground sm:px-4">
                    {getPostTypeLabel(entry.postType)}
                  </td>
                  <td className="max-w-[10rem] break-all px-3 py-3 text-foreground sm:max-w-none sm:px-4">
                    {getHistoryTargetLabel(entry)}
                  </td>
                  <td className="max-w-[12rem] px-3 py-3 text-foreground sm:max-w-md sm:px-4">
                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {truncateText(entry.postText)}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    <span
                      className={
                        reusability.reusable
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }
                    >
                      {reusability.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
