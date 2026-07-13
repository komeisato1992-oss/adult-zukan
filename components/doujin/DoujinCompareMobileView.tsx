"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CompareDescriptionReadMore } from "@/components/compare/CompareDescriptionReadMore";
import { DoujinAuthorLinks } from "@/components/doujin/DoujinAuthorLinks";
import { DoujinCircleLinks } from "@/components/doujin/DoujinCircleLinks";
import { DoujinGenreLinks } from "@/components/doujin/DoujinGenreLinks";
import { DoujinSeriesLink } from "@/components/doujin/DoujinSeriesLink";
import {
  WORK_CARD_VIEW_LABEL,
  workCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";
import {
  buildDoujinAffiliateUrl,
  isValidDoujinAffiliateUrl,
} from "@/lib/doujin/affiliate";
import { getDoujinCardImage } from "@/lib/doujin/card-image";
import {
  DOUJIN_COMPARE_GA_EVENTS,
  trackDoujinCompareEvent,
} from "@/lib/doujin/compare/analytics";
import { buildDoujinComparePageHref } from "@/lib/doujin/compare/urls";
import {
  clearDoujinCompareIds,
  removeDoujinCompareId,
} from "@/lib/doujin/compare-store";
import {
  formatDoujinPrice,
  getDoujinDiscountPercent,
} from "@/lib/doujin/format";
import type { DoujinWork } from "@/lib/doujin/types";
import { AFFILIATE_LINK_REL } from "@/lib/utils";

type DoujinCompareMobileViewProps = {
  items: DoujinWork[];
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
  work,
  sizes = "130px",
}: {
  work: DoujinWork;
  sizes?: string;
}) {
  const imageUrl = getDoujinCardImage(work);
  if (!imageUrl) {
    return (
      <div className="flex h-[170px] w-[125px] max-h-[190px] max-w-[140px] shrink-0 items-center justify-center rounded bg-surface text-xs text-muted">
        画像なし
      </div>
    );
  }
  return (
    <div className="flex h-[170px] w-[125px] max-h-[190px] max-w-[140px] shrink-0 items-center justify-center overflow-hidden rounded bg-surface">
      <Image
        src={imageUrl}
        alt={work.title}
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

function MobilePrice({ work }: { work: DoujinWork }) {
  const saleLabel = formatDoujinPrice(work.price);
  const regularLabel =
    work.originalPrice != null &&
    work.price != null &&
    work.originalPrice > work.price
      ? formatDoujinPrice(work.originalPrice)
      : undefined;
  const discount = getDoujinDiscountPercent(work);

  if (!saleLabel) return <span className="text-sm text-muted">-</span>;

  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-base font-bold text-price">{saleLabel}</span>
      {regularLabel ? (
        <span className="text-xs text-muted line-through">{regularLabel}</span>
      ) : null}
      {discount != null && discount > 0 ? (
        <span className="text-xs font-bold text-accent">{discount}%OFF</span>
      ) : null}
    </p>
  );
}

function AffiliateCta({
  work,
  source,
}: {
  work: DoujinWork;
  source: string;
}) {
  const affiliateUrl = buildDoujinAffiliateUrl(work);
  if (!isValidDoujinAffiliateUrl(affiliateUrl)) return null;
  return (
    <a
      href={affiliateUrl}
      target="_blank"
      rel={AFFILIATE_LINK_REL}
      onClick={() =>
        trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.fanzaClick, {
          content_id: work.id,
          source,
        })
      }
      className={`${workCardCtaBaseClassName} min-h-11 bg-accent text-white hover:bg-accent-hover`}
    >
      {WORK_CARD_VIEW_LABEL}
    </a>
  );
}

function SingleWorkMobileCard({ work }: { work: DoujinWork }) {
  const router = useRouter();

  function handleRemove() {
    const next = removeDoujinCompareId(work.id);
    trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.compareButtonClick, {
      content_id: work.id,
      action: "remove",
      count: next.length,
      source: "compare_mobile_single",
    });
    router.replace(buildDoujinComparePageHref(next), { scroll: false });
  }

  return (
    <article className="rounded-lg border border-border bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <Link href={`/doujin/works/${work.id}`} className="shrink-0">
          <MobileWorkImage work={work} />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-3 text-base font-bold leading-snug text-foreground">
            <Link
              href={`/doujin/works/${work.id}`}
              className="hover:text-accent"
            >
              {work.title}
            </Link>
          </h2>
          <p className="mt-2 line-clamp-2 text-sm">
            <span className="text-muted">サークル：</span>
            <DoujinCircleLinks
              circleIds={work.circleIds}
              circleNames={work.circleNames}
              circleId={work.circleId}
              circleName={work.circleName}
              className="text-sm"
              variant="link"
              separator="、"
            />
            {!work.circleName && !(work.circleNames?.length) ? "-" : null}
          </p>
          <div className="mt-2">
            <MobilePrice work={work} />
          </div>
          <p className="mt-1.5 text-sm text-foreground">
            <span className="text-muted">販売日：</span>
            {work.releaseDate ?? "-"}
          </p>
        </div>
      </div>

      {work.description ? (
        <div className="mt-3 border-t border-border pt-3">
          <CompareDescriptionReadMore lines={3}>
            {work.description}
          </CompareDescriptionReadMore>
          <p className="mt-1 text-[11px] text-muted">
            <Link
              href={`/doujin/works/${work.id}`}
              className="text-accent hover:underline"
            >
              作品詳細を見る
            </Link>
          </p>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <AffiliateCta work={work} source="compare_mobile_single" />
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

function MobileCompareTable({ items }: { items: DoujinWork[] }) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );

  const labelCol = "100px";
  const workCol = "195px";
  const gridTemplate = `${labelCol} repeat(${items.length}, ${workCol})`;

  function handleRemove(workId: string) {
    const next = removeDoujinCompareId(workId);
    trackDoujinCompareEvent(DOUJIN_COMPARE_GA_EVENTS.compareButtonClick, {
      content_id: workId,
      action: "remove",
      count: next.length,
      source: "compare_mobile_table",
    });
    router.replace(buildDoujinComparePageHref(next), { scroll: false });
  }

  const rows: Array<{
    key: string;
    label: string;
    render: (work: DoujinWork) => ReactNode;
    clamp?: boolean;
  }> = [
    {
      key: "price",
      label: "価格",
      render: (work) => <MobilePrice work={work} />,
    },
    {
      key: "regular",
      label: "通常価格",
      render: (work) =>
        work.originalPrice != null &&
        work.price != null &&
        work.originalPrice > work.price
          ? (formatDoujinPrice(work.originalPrice) ?? "-")
          : "-",
    },
    {
      key: "discount",
      label: "割引率",
      render: (work) => {
        const discount = getDoujinDiscountPercent(work);
        return discount != null && discount > 0 ? `${discount}%OFF` : "-";
      },
    },
    {
      key: "sale",
      label: "セール",
      render: (work) => (work.isSale ? "セール中" : "-"),
    },
    {
      key: "circle",
      label: "サークル",
      clamp: true,
      render: (work) => (
        <>
          <DoujinCircleLinks
            circleIds={work.circleIds}
            circleNames={work.circleNames}
            circleId={work.circleId}
            circleName={work.circleName}
            className="text-xs"
            variant="link"
            separator="、"
          />
          {!work.circleName && !(work.circleNames?.length) ? "-" : null}
        </>
      ),
    },
    {
      key: "author",
      label: "作者",
      clamp: true,
      render: (work) =>
        (work.authorNames ?? []).length > 0 ? (
          <DoujinAuthorLinks
            authorIds={work.authorIds}
            authorNames={work.authorNames}
            className="text-xs"
            variant="link"
            separator="、"
          />
        ) : (
          "-"
        ),
    },
    {
      key: "series",
      label: "シリーズ",
      clamp: true,
      render: (work) => (
        <DoujinSeriesLink
          seriesId={work.seriesId}
          seriesName={work.seriesName}
          className="text-xs"
          variant="link"
        />
      ),
    },
    {
      key: "genre",
      label: "ジャンル",
      clamp: true,
      render: (work) =>
        (work.genreNames ?? []).length > 0 ? (
          <DoujinGenreLinks
            genreIds={work.genreIds}
            genreNames={work.genreNames}
            className="text-xs"
            variant="link"
            separator="、"
          />
        ) : (
          "-"
        ),
    },
    {
      key: "format",
      label: "作品形式",
      render: (work) =>
        work.productFormatNormalized ?? work.productFormat ?? "-",
    },
    {
      key: "release",
      label: "販売日",
      render: (work) => work.releaseDate ?? "-",
    },
    {
      key: "rating",
      label: "評価",
      render: (work) =>
        work.rating != null ? String(work.rating) : "-",
    },
    {
      key: "reviews",
      label: "レビュー数",
      render: (work) =>
        work.reviewCount != null ? `${work.reviewCount}件` : "-",
    },
    {
      key: "description",
      label: "作品説明",
      clamp: true,
      render: (work) =>
        work.description ? (
          <span className="text-sm leading-relaxed">{work.description}</span>
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
          {items.map((work) => (
            <div
              key={`head-${work.id}`}
              className="border-b border-border bg-white px-2 py-3"
              style={{ width: workCol, minWidth: workCol }}
            >
              <div className="flex flex-col items-center">
                <Link href={`/doujin/works/${work.id}`}>
                  <MobileWorkImage work={work} sizes="125px" />
                </Link>
                <h2 className="mt-2 w-full line-clamp-3 min-h-[3.6rem] text-sm font-bold leading-snug text-foreground">
                  <Link
                    href={`/doujin/works/${work.id}`}
                    className="hover:text-accent"
                  >
                    {work.title}
                  </Link>
                </h2>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs">
                <span className="text-muted">サークル：</span>
                <DoujinCircleLinks
                  circleIds={work.circleIds}
                  circleNames={work.circleNames}
                  circleId={work.circleId}
                  circleName={work.circleName}
                  className="text-xs"
                  variant="link"
                  separator="、"
                />
                {!work.circleName && !(work.circleNames?.length) ? "-" : null}
              </p>
              <div className="mt-1.5">
                <MobilePrice work={work} />
              </div>
              <p className="mt-1 text-xs text-foreground">
                <span className="text-muted">販売日：</span>
                {work.releaseDate ?? "-"}
              </p>
              <div className="mt-2">
                <AffiliateCta work={work} source="compare_mobile_table" />
              </div>
              <button
                type="button"
                onClick={() => handleRemove(work.id)}
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
              {items.map((work) => (
                <div
                  key={`${row.key}-${work.id}`}
                  className={`border-b border-border px-2 py-2 text-xs break-words text-foreground ${
                    rowIndex % 2 === 0 ? "bg-white" : "bg-surface"
                  }`}
                  style={{ width: workCol, minWidth: workCol }}
                >
                  {row.clamp ? (
                    <MobileClampCell>{row.render(work)}</MobileClampCell>
                  ) : (
                    row.render(work)
                  )}
                </div>
              ))}
            </div>
          ))}

          <div className="sticky left-0 z-10 border-r border-border bg-gray-50 px-2 py-2 text-[11px] font-medium text-muted">
            サンプル
          </div>
          {items.map((work) => {
            const samples = (work.sampleImageUrls ?? []).slice(0, 3);
            return (
              <div
                key={`sample-${work.id}`}
                className="border-b border-border px-2 py-2"
                style={{ width: workCol, minWidth: workCol }}
              >
                {samples.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1">
                    {samples.map((src, index) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() =>
                          setLightbox({
                            src,
                            alt: `${work.title} サンプル${index + 1}`,
                          })
                        }
                        className="overflow-hidden rounded border border-border"
                      >
                        <Image
                          src={src}
                          alt={`${work.title} サンプル${index + 1}`}
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
            );
          })}
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

export function DoujinCompareMobileView({ items }: DoujinCompareMobileViewProps) {
  const router = useRouter();

  function handleClear() {
    if (!window.confirm("比較リストをすべてクリアしますか？")) return;
    clearDoujinCompareIds();
    router.replace("/doujin/compare", { scroll: false });
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
        <SingleWorkMobileCard work={items[0]} />
      ) : items.length >= 2 ? (
        <MobileCompareTable items={items} />
      ) : null}
    </section>
  );
}
