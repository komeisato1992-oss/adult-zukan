"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CompareDescriptionReadMore } from "@/components/compare/CompareDescriptionReadMore";
import type { CompareItem } from "@/components/compare/compare-item-types";
import {
  clearCompareIds,
  removeCompareId,
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

function MobileClampCell({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div className={expanded ? "" : "line-clamp-3 overflow-hidden"}>
        {children}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="mt-1 text-[11px] text-accent hover:underline"
        aria-expanded={expanded}
      >
        {expanded ? "閉じる" : "続きを読む"}
      </button>
    </div>
  );
}

function MobileWorkImage({
  item,
  sizes = "130px",
}: {
  item: CompareItem;
  sizes?: string;
}) {
  if (!item.imageUrl) {
    return (
      <div className="flex h-[170px] w-[125px] max-h-[190px] max-w-[140px] shrink-0 items-center justify-center rounded bg-surface text-xs text-muted">
        画像なし
      </div>
    );
  }
  return (
    <div className="flex h-[170px] w-[125px] max-h-[190px] max-w-[140px] shrink-0 items-center justify-center overflow-hidden rounded bg-surface">
      <Image
        src={item.imageUrl}
        alt={item.title}
        width={125}
        height={170}
        className="h-auto max-h-[170px] w-auto max-w-full object-contain"
        sizes={sizes}
        loading="lazy"
        unoptimized
      />
    </div>
  );
}

function MobilePrice({ item }: { item: CompareItem }) {
  const saleLabel =
    item.currentPrice != null ? formatPriceYen(item.currentPrice) : item.price;
  const regularLabel =
    item.regularPrice != null &&
    item.currentPrice != null &&
    item.regularPrice > item.currentPrice
      ? formatPriceYen(item.regularPrice)
      : undefined;

  if (!saleLabel) return <span className="text-sm text-muted">-</span>;

  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-base font-bold text-price">{saleLabel}</span>
      {regularLabel ? (
        <span className="text-xs text-muted line-through">{regularLabel}</span>
      ) : null}
    </p>
  );
}

function SingleWorkMobileCard({ item }: { item: CompareItem }) {
  const router = useRouter();

  function handleRemove() {
    const next = removeCompareId(item.contentId);
    trackCompareEvent(COMPARE_GA_EVENTS.compareButtonClick, {
      content_id: item.contentId,
      action: "remove",
      count: next.length,
      source: "compare_mobile_single",
    });
    router.replace(buildComparePageHref(next), { scroll: false });
  }

  return (
    <article className="rounded-lg border border-border bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <Link href={`/works/${item.contentId}`} className="shrink-0">
          <MobileWorkImage item={item} />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-3 text-base font-bold leading-snug text-foreground">
            <Link
              href={`/works/${item.contentId}`}
              className="hover:text-accent"
            >
              {item.title}
            </Link>
          </h2>
          <p className="mt-2 line-clamp-2 text-sm">
            <span className="text-muted">女優：</span>
            {item.actressNames.length > 0 ? (
              <ActressNameLinks names={item.actressNames} />
            ) : (
              "-"
            )}
          </p>
          <div className="mt-2">
            <MobilePrice item={item} />
          </div>
          <p className="mt-1.5 text-sm text-foreground">
            <span className="text-muted">再生時間：</span>
            {item.duration ?? "-"}
          </p>
        </div>
      </div>

      {item.description ? (
        <div className="mt-3 border-t border-border pt-3">
          <CompareDescriptionReadMore lines={3}>
            {item.description}
          </CompareDescriptionReadMore>
          <p className="mt-1 text-[11px] text-muted">
            <Link
              href={`/works/${item.contentId}`}
              className="text-accent hover:underline"
            >
              作品詳細を見る
            </Link>
          </p>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {item.fanzaUrl ? (
          <a
            href={item.fanzaUrl}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            onClick={() =>
              trackCompareEvent(COMPARE_GA_EVENTS.fanzaClick, {
                content_id: item.contentId,
                source: "compare_mobile_single",
              })
            }
            className={`${workCardCtaBaseClassName} min-h-11 bg-accent text-white hover:bg-accent-hover`}
          >
            {WORK_CARD_VIEW_LABEL}
          </a>
        ) : null}
        <button
          type="button"
          onClick={handleRemove}
          className={`${workCardCtaBaseClassName} min-h-11 border border-border bg-white text-muted hover:border-accent hover:text-accent`}
        >
          比較から削除
        </button>
      </div>
    </article>
  );
}

function MobileCompareTable({ items }: { items: CompareItem[] }) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );

  const labelCol = "100px";
  const workCol = "195px";
  const gridTemplate = `${labelCol} repeat(${items.length}, ${workCol})`;

  function handleRemove(contentId: string) {
    const next = removeCompareId(contentId);
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
    clamp?: boolean;
  }> = [
    {
      key: "price",
      label: "価格",
      render: (item) => <MobilePrice item={item} />,
    },
    {
      key: "regular",
      label: "通常価格",
      render: (item) =>
        item.regularPrice &&
        item.currentPrice &&
        item.regularPrice > item.currentPrice
          ? (formatPriceYen(item.regularPrice) ?? "-")
          : "-",
    },
    {
      key: "discount",
      label: "割引率",
      render: (item) =>
        item.discountRate != null && item.discountRate > 0
          ? `${item.discountRate}%OFF`
          : "-",
    },
    {
      key: "sale",
      label: "セール",
      render: (item) => (item.onSale ? "セール中" : "-"),
    },
    {
      key: "actress",
      label: "出演女優",
      clamp: true,
      render: (item) =>
        item.actressNames.length > 0 ? (
          <ActressNameLinks names={item.actressNames} />
        ) : (
          "-"
        ),
    },
    {
      key: "maker",
      label: "メーカー",
      render: (item) => item.makerName ?? "-",
    },
    {
      key: "label",
      label: "レーベル",
      render: (item) => item.labelName ?? "-",
    },
    {
      key: "series",
      label: "シリーズ",
      clamp: true,
      render: (item) => item.series ?? "-",
    },
    {
      key: "genre",
      label: "ジャンル",
      clamp: true,
      render: (item) =>
        item.genres.length > 0 ? <GenreNameLinks names={item.genres} /> : "-",
    },
    {
      key: "release",
      label: "発売日",
      render: (item) => item.releaseDate ?? "-",
    },
    {
      key: "duration",
      label: "再生時間",
      render: (item) => item.duration ?? "-",
    },
    {
      key: "rating",
      label: "評価",
      render: (item) => item.rating ?? "-",
    },
    {
      key: "reviews",
      label: "レビュー数",
      render: (item) =>
        item.reviewCount != null ? `${item.reviewCount}件` : "-",
    },
    {
      key: "description",
      label: "作品説明",
      clamp: true,
      render: (item) =>
        item.description ? (
          <span className="text-sm leading-relaxed">{item.description}</span>
        ) : (
          "-"
        ),
    },
  ];

  return (
    <div className="w-full max-w-full">
      <p className="mb-2 flex items-center gap-1 text-xs text-muted">
        <span aria-hidden>←</span>
        横にスワイプして比較できます
        <span aria-hidden>→</span>
      </p>
      <div className="w-full max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
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
          {items.map((item) => (
            <div
              key={`head-${item.contentId}`}
              className="border-b border-border bg-white px-2 py-3"
              style={{ width: workCol, minWidth: workCol }}
            >
              <div className="flex flex-col items-center">
                <Link href={`/works/${item.contentId}`}>
                  <MobileWorkImage item={item} sizes="125px" />
                </Link>
                <h2 className="mt-2 w-full line-clamp-3 min-h-[3.6rem] text-sm font-bold leading-snug text-foreground">
                  <Link
                    href={`/works/${item.contentId}`}
                    className="hover:text-accent"
                  >
                    {item.title}
                  </Link>
                </h2>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs">
                <span className="text-muted">女優：</span>
                {item.actressNames.length > 0 ? (
                  <ActressNameLinks names={item.actressNames} />
                ) : (
                  "-"
                )}
              </p>
              <div className="mt-1.5">
                <MobilePrice item={item} />
              </div>
              <p className="mt-1 text-xs text-foreground">
                <span className="text-muted">再生時間：</span>
                {item.duration ?? "-"}
              </p>
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
                  className={`${workCardCtaBaseClassName} mt-2 min-h-11 bg-accent text-white hover:bg-accent-hover`}
                >
                  {WORK_CARD_VIEW_LABEL}
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => handleRemove(item.contentId)}
                className="mt-2 min-h-11 w-full py-2 text-center text-xs text-muted underline-offset-2 hover:text-accent hover:underline"
              >
                比較から削除
              </button>
            </div>
          ))}

          {rows.map((row, rowIndex) => (
            <div key={row.key} className="contents">
              <div
                className={`sticky left-0 z-10 border-r border-border px-2 py-2 text-[11px] font-medium text-muted ${
                  rowIndex % 2 === 0 ? "bg-gray-50" : "bg-gray-100"
                }`}
              >
                {row.label}
              </div>
              {items.map((item) => (
                <div
                  key={`${row.key}-${item.contentId}`}
                  className={`border-b border-border px-2 py-2 text-xs break-words text-foreground ${
                    rowIndex % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"
                  }`}
                  style={{ width: workCol, minWidth: workCol }}
                >
                  {row.clamp ? (
                    <MobileClampCell>{row.render(item)}</MobileClampCell>
                  ) : (
                    row.render(item)
                  )}
                </div>
              ))}
            </div>
          ))}

          <div className="sticky left-0 z-10 border-r border-border bg-gray-50 px-2 py-2 text-[11px] font-medium text-muted">
            サンプル
          </div>
          {items.map((item) => (
            <div
              key={`sample-${item.contentId}`}
              className="border-b border-border px-2 py-2"
              style={{ width: workCol, minWidth: workCol }}
            >
              {item.sampleImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-1">
                  {item.sampleImages.slice(0, 3).map((src, index) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src,
                          alt: `${item.title} サンプル${index + 1}`,
                        })
                      }
                      className="overflow-hidden rounded border border-border"
                    >
                      <Image
                        src={src}
                        alt={`${item.title} サンプル${index + 1}`}
                        width={56}
                        height={40}
                        className="h-auto w-full object-contain"
                        loading="lazy"
                        unoptimized
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted">-</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightbox(null)}
          aria-label="閉じる"
        >
          <Image
            src={lightbox.src}
            alt={lightbox.alt}
            width={360}
            height={240}
            className="max-h-[80vh] w-auto max-w-full object-contain"
            unoptimized
          />
        </button>
      ) : null}
    </div>
  );
}

export function CompareMobileView({ items }: CompareMobileViewProps) {
  const router = useRouter();

  function handleClear() {
    if (!window.confirm("比較リストをすべてクリアしますか？")) return;
    clearCompareIds();
    router.replace("/compare", { scroll: false });
  }

  return (
    <section className="mt-3 w-full max-w-full">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
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

      {items.length === 1 ? (
        <SingleWorkMobileCard item={items[0]} />
      ) : items.length >= 2 ? (
        <MobileCompareTable items={items} />
      ) : null}
    </section>
  );
}
