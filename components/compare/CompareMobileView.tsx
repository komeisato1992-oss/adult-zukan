"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import type { CompareItem } from "@/components/compare/compare-item-types";
import {
  ClampExpandable,
  CompareEntityNameLink,
} from "@/components/compare/compare-table-cells";
import {
  clearCompareIds,
  setCompareIds,
} from "@/components/compare/compare-store";
import { ActressNameLinks } from "@/components/ui/ActressNameLinks";
import { GenreNameLinks } from "@/components/ui/GenreNameLinks";
import {
  WORK_CARD_VIEW_LABEL,
  workCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";
import {
  COMPARE_GA_EVENTS,
  trackCompareEvent,
} from "@/lib/compare/analytics";
import { formatPriceYen } from "@/lib/compare/types";
import { buildComparePageHref } from "@/lib/compare/urls";

type CompareMobileViewProps = {
  items: CompareItem[];
};

const LABEL_COL = 92;
const WORK_COL = 180;
const IMAGE_HEIGHT = 150;

function MobilePrice({ item }: { item: CompareItem }) {
  const saleLabel =
    item.currentPrice != null ? formatPriceYen(item.currentPrice) : item.price;
  const regularLabel =
    item.regularPrice != null &&
    item.currentPrice != null &&
    item.regularPrice > item.currentPrice
      ? formatPriceYen(item.regularPrice)
      : item.regularPrice != null && item.currentPrice == null
        ? formatPriceYen(item.regularPrice)
        : undefined;

  if (!saleLabel && !regularLabel) {
    return <span className="text-sm text-muted">—</span>;
  }

  return (
    <p className="flex flex-col gap-0.5">
      {saleLabel ? (
        <span className="text-sm font-bold text-price">{saleLabel}</span>
      ) : null}
      {regularLabel ? (
        <span className="text-[11px] text-muted line-through">{regularLabel}</span>
      ) : null}
    </p>
  );
}

export function CompareMobileView({ items }: CompareMobileViewProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemKey = items.map((item) => item.contentId).join(",");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [itemKey]);

  function handleClear() {
    if (!window.confirm("比較リストをすべてクリアしますか？")) return;
    clearCompareIds();
    router.replace("/compare", { scroll: false });
  }

  function handleRemove(contentId: string) {
    const next = items
      .map((item) => item.contentId)
      .filter((id) => id !== contentId);
    setCompareIds(next);
    trackCompareEvent(COMPARE_GA_EVENTS.compareButtonClick, {
      content_id: contentId,
      action: "remove",
      count: next.length,
      source: "compare_mobile_table",
    });
    router.replace(buildComparePageHref(next), { scroll: false });
  }

  const rows: Array<{
    key: string;
    label: string;
    render: (item: CompareItem) => ReactNode;
  }> = [
    {
      key: "image",
      label: "画像",
      render: (item) => (
        <Link href={`/works/${item.contentId}`} className="block">
          {item.imageUrl ? (
            <div
              className="mx-auto flex w-full items-center justify-center overflow-hidden rounded bg-surface"
              style={{ height: IMAGE_HEIGHT }}
            >
              <Image
                src={item.imageUrl}
                alt={item.title}
                width={160}
                height={IMAGE_HEIGHT}
                className="h-auto max-h-full w-auto max-w-full object-contain"
                sizes={`${WORK_COL}px`}
                loading="lazy"
                unoptimized
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded bg-surface text-xs text-muted"
              style={{ height: IMAGE_HEIGHT }}
            >
              画像なし
            </div>
          )}
        </Link>
      ),
    },
    {
      key: "title",
      label: "タイトル",
      render: (item) => (
        <ClampExpandable
          text={item.title}
          href={`/works/${item.contentId}`}
          textClassName="text-sm font-bold text-foreground"
        />
      ),
    },
    {
      key: "price",
      label: "価格",
      render: (item) => <MobilePrice item={item} />,
    },
    {
      key: "actress",
      label: "女優",
      render: (item) =>
        item.actressNames.length > 0 ? (
          <ActressNameLinks names={item.actressNames} />
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "duration",
      label: "再生時間",
      render: (item) => item.duration ?? "—",
    },
    {
      key: "release",
      label: "発売日",
      render: (item) => item.releaseDate ?? "—",
    },
    {
      key: "genre",
      label: "ジャンル",
      render: (item) =>
        item.genres.length > 0 ? (
          <GenreNameLinks names={item.genres.slice(0, 6)} />
        ) : (
          "—"
        ),
    },
    {
      key: "maker",
      label: "メーカー",
      render: (item) => (
        <CompareEntityNameLink name={item.makerName} kind="maker" />
      ),
    },
    {
      key: "label",
      label: "レーベル",
      render: (item) => (
        <CompareEntityNameLink name={item.labelName} kind="label" />
      ),
    },
    {
      key: "series",
      label: "シリーズ",
      render: (item) => (
        <CompareEntityNameLink name={item.series} kind="series" />
      ),
    },
    {
      key: "rating",
      label: "評価",
      render: (item) => item.rating ?? "—",
    },
    {
      key: "reviews",
      label: "お気に入り数",
      render: (item) =>
        item.reviewCount != null ? `${item.reviewCount}` : "—",
    },
    {
      key: "format",
      label: "作品形式",
      render: (item) => item.workFormat ?? "—",
    },
    {
      key: "description",
      label: "説明",
      render: (item) => (
        <ClampExpandable
          text={item.description}
          textClassName="text-xs leading-relaxed text-foreground"
        />
      ),
    },
    {
      key: "actions",
      label: "操作",
      render: (item) => (
        <div className="flex flex-col gap-2">
          <Link
            href={`/works/${item.contentId}`}
            className="flex h-10 w-full items-center justify-center rounded-md border border-accent text-xs font-bold text-accent hover:bg-accent-light"
          >
            作品詳細
          </Link>
          {item.fanzaUrl ? (
            <a
              href={item.fanzaUrl}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              onClick={() =>
                trackCompareEvent(COMPARE_GA_EVENTS.fanzaClick, {
                  content_id: item.contentId,
                  source: "compare_mobile_table",
                })
              }
              className={`${workCardCtaBaseClassName} h-10 min-h-10 bg-accent px-1 text-xs text-white hover:bg-accent-hover`}
            >
              {WORK_CARD_VIEW_LABEL}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => handleRemove(item.contentId)}
            className="w-full py-2.5 text-center text-xs font-medium text-accent hover:underline"
          >
            比較から外す
          </button>
        </div>
      ),
    },
  ];

  const gridTemplate = `${LABEL_COL}px repeat(${items.length}, ${WORK_COL}px)`;

  return (
    <section className="mt-3 w-full max-w-full pb-[calc(72px+env(safe-area-inset-bottom,0px))]">
      <div className="sticky top-0 z-30 -mx-4 mb-3 border-b border-border bg-white/95 px-4 py-2 backdrop-blur">
        <div className="flex items-end justify-between gap-3">
          <p className="min-w-0 text-sm text-muted">
            最大4作品を比較できます（現在 {items.length} 件）
          </p>
          {items.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 text-sm font-medium text-accent hover:underline"
            >
              比較をクリア
            </button>
          ) : null}
        </div>
      </div>

      {items.length >= 2 ? (
        <p className="mb-2 flex items-center gap-1 text-xs text-muted">
          <span aria-hidden>←</span>
          横にスワイプして比較できます
          <span aria-hidden>→</span>
        </p>
      ) : null}

      <div
        ref={scrollRef}
        className="w-full max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
      >
        <div
          className="min-w-max"
          style={{
            display: "grid",
            gridTemplateColumns: gridTemplate,
          }}
        >
          <div className="sticky left-0 z-20 border-b border-r border-border bg-gray-50 px-2 py-2 text-[11px] font-bold text-muted">
            項目
          </div>
          {items.map((item, index) => (
            <div
              key={`head-${item.contentId}`}
              className="border-b border-border bg-white px-2 py-2 text-center text-[11px] font-bold text-foreground"
              style={{ width: WORK_COL, minWidth: WORK_COL }}
            >
              作品{index + 1}
            </div>
          ))}

          {rows.map((row, rowIndex) => (
            <div key={row.key} className="contents">
              <div
                className={`sticky left-0 z-10 border-r border-border px-2 py-2.5 text-[11px] font-medium text-muted ${
                  rowIndex % 2 === 0 ? "bg-gray-50" : "bg-gray-100"
                }`}
              >
                {row.label}
              </div>
              {items.map((item) => (
                <div
                  key={`${row.key}-${item.contentId}`}
                  className={`border-b border-border px-2 py-2.5 text-xs break-words text-foreground ${
                    rowIndex % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"
                  }`}
                  style={{ width: WORK_COL, minWidth: WORK_COL }}
                >
                  {row.render(item)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {items.length === 1 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border bg-surface px-3 py-3 text-center text-sm text-muted">
          もう1作品追加すると比較できます
        </p>
      ) : null}
    </section>
  );
}
