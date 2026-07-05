"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PageLayout } from "@/components/layout/PageLayout";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Error]", error);
  }, [error]);

  return (
    <PageLayout showSidebar={false}>
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-7xl font-bold text-border">500</p>
        <h1 className="mt-4 text-xl font-bold text-foreground">
          サーバーエラーが発生しました
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          一時的な問題が発生した可能性があります。しばらく時間をおいてから再度お試しください。
        </p>
        <div className="mt-8 flex gap-4">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center rounded bg-accent px-6 text-sm font-medium text-white hover:bg-accent-hover"
          >
            再読み込み
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded border border-border px-6 text-sm font-medium text-foreground hover:bg-surface"
          >
            トップへ戻る
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
