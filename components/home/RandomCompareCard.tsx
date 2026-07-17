import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { imageCoverClassName } from "@/components/ui/image-cover";

export type RandomCompareCardData = {
  contentId: string;
  title: string;
  imageUrl?: string;
  price?: string;
  actressNames: string[];
  duration?: string;
};

type RandomCompareCardProps = {
  item: RandomCompareCardData;
  /**
   * responsive: TOP「今日のランダム比較」用（スマホ縦 / PC横）
   * stacked: 比較候補カルーセル用（常に縦積み）
   */
  layout?: "responsive" | "stacked";
  className?: string;
  children?: ReactNode;
};

/** 女優名を1行用に要約。+0名は出さない */
export function formatActressSummary(
  names: string[],
  maxVisible: number,
): string {
  if (names.length === 0) return "-";
  const visibleCount = Math.min(maxVisible, names.length);
  const visible = names.slice(0, visibleCount);
  const rest = names.length - visibleCount;
  const label = visible.join("、");
  if (rest > 0) return `${label} +${rest}名`;
  return label;
}

export function RandomCompareCard({
  item,
  layout = "responsive",
  className = "",
  children,
}: RandomCompareCardProps) {
  const actressMobile = formatActressSummary(item.actressNames, 1);
  const actressDesktop = formatActressSummary(item.actressNames, 2);
  const duration = item.duration?.trim() || "-";
  const isStacked = layout === "stacked";

  return (
    <article
      className={`flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-sm ${
        isStacked
          ? ""
          : "flex-1 min-[769px]:flex-row min-[769px]:gap-4 min-[769px]:rounded-xl min-[769px]:p-3.5"
      } ${className}`.trim()}
    >
      <Link
        href={`/works/${item.contentId}`}
        prefetch
        className={`relative block w-full shrink-0 overflow-hidden bg-surface ${
          isStacked
            ? "rounded-t-lg"
            : "rounded-t-lg min-[769px]:hidden"
        }`}
        aria-label={`${item.title} の作品ページへ`}
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.title}
            width={400}
            height={600}
            sizes={
              isStacked
                ? "(max-width: 768px) 70vw, 300px"
                : "(max-width: 768px) 45vw, 130px"
            }
            className="h-auto w-full object-contain"
            unoptimized
          />
        ) : (
          <div className="aspect-[2/3] w-full bg-surface" />
        )}
      </Link>

      {!isStacked ? (
        <Link
          href={`/works/${item.contentId}`}
          prefetch
          className="ml-auto hidden shrink-0 self-start min-[769px]:order-2 min-[769px]:block"
          aria-label={`${item.title} の作品ページへ`}
          tabIndex={-1}
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt=""
              width={120}
              height={170}
              className={`h-auto w-[115px] max-w-[115px] rounded-lg md:ml-2 md:w-[130px] md:max-w-[130px] ${imageCoverClassName}`}
              unoptimized
            />
          ) : (
            <div className="h-[150px] w-[115px] rounded-lg bg-surface md:w-[130px]" />
          )}
        </Link>
      ) : null}

      <div
        className={`min-w-0 flex-1 px-1.5 py-1.5 ${
          isStacked ? "" : "min-[769px]:order-1 min-[769px]:px-0 min-[769px]:py-0"
        }`}
      >
        <Link
          href={`/works/${item.contentId}`}
          prefetch
          className={`line-clamp-2 font-bold leading-snug text-foreground transition-colors hover:text-accent ${
            isStacked
              ? "text-sm"
              : "text-[11px] min-[769px]:text-sm"
          }`}
        >
          {item.title}
        </Link>

        <dl
          className={`mt-1 space-y-0.5 leading-tight ${
            isStacked
              ? "text-xs min-[769px]:mt-2 min-[769px]:space-y-1 min-[769px]:text-sm min-[769px]:leading-normal"
              : "text-[10px] min-[769px]:mt-2 min-[769px]:space-y-1 min-[769px]:text-sm min-[769px]:leading-normal"
          }`}
        >
          <div>
            <dt className="inline text-muted">価格：</dt>
            <dd className="inline font-bold text-price">{item.price ?? "-"}</dd>
          </div>
          <div className="flex min-w-0 items-baseline gap-0">
            <dt className="shrink-0 text-muted">女優：</dt>
            {isStacked ? (
              <dd className="min-w-0 truncate text-foreground">
                {actressDesktop}
              </dd>
            ) : (
              <>
                <dd className="min-w-0 truncate text-foreground min-[769px]:hidden">
                  {actressMobile}
                </dd>
                <dd className="hidden min-w-0 truncate text-foreground min-[769px]:inline">
                  {actressDesktop}
                </dd>
              </>
            )}
          </div>
          <div>
            <dt className="inline text-muted">再生時間：</dt>
            <dd className="inline text-foreground">{duration}</dd>
          </div>
        </dl>

        {children ? <div className="mt-2.5">{children}</div> : null}
      </div>
    </article>
  );
}
