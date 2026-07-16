import { WORK_LIST_GRID_CLASSNAME } from "@/components/works/work-list-grid";

/** ルート遷移用の軽量スケルトン（ライブラリなし・CSSのみ） */
export function RouteLoadingSkeleton({
  title = "読み込み中",
  cards = 8,
}: {
  title?: string;
  cards?: number;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-6 min-[769px]:px-4" aria-busy="true" aria-live="polite">
      <p className="mb-4 text-sm text-muted">{title}</p>
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-surface" />
      <div className={WORK_LIST_GRID_CLASSNAME}>
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-lg border border-border/70 bg-white"
          >
            <div className="aspect-[3/4] animate-pulse bg-surface" />
            <div className="space-y-2 p-2.5">
              <div className="h-3.5 animate-pulse rounded bg-surface" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-surface" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
