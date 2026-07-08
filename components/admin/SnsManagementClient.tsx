"use client";

import { useState } from "react";
import { SnsPostCard } from "@/components/admin/SnsPostCard";
import { SnsPostHistory } from "@/components/admin/SnsPostHistory";
import type { SnsPostHistoryEntry } from "@/lib/admin/sns-post-history-types";
import type { SnsScheduledPost } from "@/lib/admin/sns-types";

type SnsManagementClientProps = {
  initialPosts: SnsScheduledPost[];
  initialHistory: SnsPostHistoryEntry[];
};

export function SnsManagementClient({
  initialPosts,
  initialHistory,
}: SnsManagementClientProps) {
  const [history, setHistory] = useState(initialHistory);

  function handlePosted(entry: SnsPostHistoryEntry) {
    setHistory((current) => [entry, ...current]);
  }

  return (
    <div className="w-full max-w-full space-y-10 overflow-x-hidden">
      <section className="w-full max-w-full space-y-4 overflow-x-hidden">
        <h2 className="text-lg font-bold text-foreground">今日の投稿</h2>
        <div className="grid w-full max-w-full gap-4">
          {initialPosts.map((post) => (
            <SnsPostCard key={post.slot} post={post} onPosted={handlePosted} />
          ))}
        </div>
      </section>

      <SnsPostHistory entries={history} />
    </div>
  );
}
