"use client";

import { useCallback, useState } from "react";
import { ImportCandidateCard } from "@/components/admin/ImportCandidateCard";
import type {
  ImportCandidate,
  ImportCandidatesResult,
} from "@/lib/admin/import-candidates";

type ImportManagementClientProps = {
  initialData: ImportCandidatesResult;
};

export function ImportManagementClient({
  initialData,
}: ImportManagementClientProps) {
  const [data, setData] = useState(initialData);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allCandidates: ImportCandidate[] = [
    ...data.newWorks,
    ...data.randomWorks,
  ].filter((candidate) => !excludedIds.has(candidate.item.content_id));

  const visibleNew = allCandidates.filter((candidate) => candidate.source === "new");
  const visibleRandom = allCandidates.filter(
    (candidate) => candidate.source === "random",
  );

  const handleExclude = useCallback((contentId: string) => {
    setExcludedIds((current) => new Set([...current, contentId]));
  }, []);

  async function handleRefresh() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/import/candidates", {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "候補作品の再取得に失敗しました。");
      }

      const nextData = (await response.json()) as ImportCandidatesResult;
      setData(nextData);
      setExcludedIds(new Set());
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "候補作品の再取得に失敗しました。",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!data.configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        {data.message ??
          "DMM API の認証情報が未設定のため、候補作品を取得できません。"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-bold text-foreground">候補作品サマリー</p>
          <p className="mt-1 text-sm text-muted">
            FANZA新作 {visibleNew.length} 件 / 未掲載ランダム {visibleRandom.length}{" "}
            件（合計 {allCandidates.length} 件）
          </p>
          {data.message ? (
            <p className="mt-1 text-xs text-muted">{data.message}</p>
          ) : null}
          {excludedIds.size > 0 ? (
            <p className="mt-1 text-xs text-muted">
              除外中: {excludedIds.size} 件
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex h-11 min-h-[44px] items-center rounded-lg border border-border px-4 text-sm text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {loading ? "取得中..." : "候補を再取得"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {allCandidates.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-muted">
          表示できる候補作品がありません。候補を再取得するか、除外を解除してください。
        </div>
      ) : (
        <>
          {visibleNew.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">
                FANZA新作（{visibleNew.length}件）
              </h2>
              <div className="space-y-4">
                {visibleNew.map((candidate) => (
                  <ImportCandidateCard
                    key={candidate.item.content_id}
                    item={candidate.item}
                    source={candidate.source}
                    sourceLabel={candidate.sourceLabel}
                    onExclude={handleExclude}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {visibleRandom.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">
                未掲載ランダム（{visibleRandom.length}件）
              </h2>
              <div className="space-y-4">
                {visibleRandom.map((candidate) => (
                  <ImportCandidateCard
                    key={candidate.item.content_id}
                    item={candidate.item}
                    source={candidate.source}
                    sourceLabel={candidate.sourceLabel}
                    onExclude={handleExclude}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
