"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DoujinCardImage } from "@/components/doujin/DoujinCardImage";
import { DoujinAuthorLinks } from "@/components/doujin/DoujinAuthorLinks";
import { DoujinCircleLinks } from "@/components/doujin/DoujinCircleLinks";
import { DoujinCompareToggleButton } from "@/components/doujin/DoujinCompareToggleButton";
import { DoujinGenreLinks } from "@/components/doujin/DoujinGenreLinks";
import { DoujinProductFormatBadge } from "@/components/doujin/DoujinProductFormatBadge";
import { DoujinSeriesLink } from "@/components/doujin/DoujinSeriesLink";
import { buildDoujinAffiliateUrl, isValidDoujinAffiliateUrl } from "@/lib/doujin/affiliate";
import { getDoujinCardImage } from "@/lib/doujin/card-image";
import {
  clearDoujinCompareIds,
  readDoujinCompareIds,
  setDoujinCompareIds,
  subscribeDoujinCompareStore,
} from "@/lib/doujin/compare-store";
import { formatDoujinPrice } from "@/lib/doujin/format";
import type { DoujinWork } from "@/lib/doujin/types";
import { AFFILIATE_LINK_REL } from "@/lib/utils";
import { workCardCtaBaseClassName } from "@/components/works/work-card-cta-styles";

export function DoujinComparePageClient() {
  const searchParams = useSearchParams();
  const [ids, setIds] = useState<string[]>([]);
  const [items, setItems] = useState<DoujinWork[]>([]);

  useEffect(() => {
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const urlIds = idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 3);
      if (urlIds.length > 0) {
        setDoujinCompareIds(urlIds);
      }
    }

    const sync = () => setIds(readDoujinCompareIds().slice(0, 3));
    sync();
    return subscribeDoujinCompareStore(sync);
  }, [searchParams]);

  useEffect(() => {
    if (ids.length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/doujin/compare?ids=${encodeURIComponent(ids.join(","))}`)
      .then((response) => response.json())
      .then((json: { items?: DoujinWork[] }) => {
        if (!cancelled) setItems(json.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const clearable = useMemo(() => items.length > 0, [items.length]);

  if (ids.length === 0) {
    return (
      <section className="mt-8 rounded border border-border bg-surface p-8 text-center">
        <h2 className="text-lg font-bold text-foreground">比較する作品がありません</h2>
        <Link
          href="/doujin/works"
          className="mt-4 inline-flex rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
        >
          作品一覧へ
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          最大3作品を比較できます（現在 {items.length} 件）
        </p>
        {clearable ? (
          <button
            type="button"
            onClick={() => clearDoujinCompareIds()}
            className="text-sm text-accent hover:underline"
          >
            比較をクリア
          </button>
        ) : null}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="grid min-w-[860px] gap-4 md:grid-cols-3">
          {items.map((work) => {
            const affiliateUrl = buildDoujinAffiliateUrl(work);
            const validUrl = isValidDoujinAffiliateUrl(affiliateUrl);
            const imageUrl = getDoujinCardImage(work);
            return (
              <article
                key={work.id}
                className="rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <Link
                  href={`/doujin/works/${work.id}`}
                  className="doujin-work-card__image-wrapper mx-auto block w-full overflow-hidden rounded"
                >
                  <DoujinCardImage src={imageUrl} alt={work.title} />
                </Link>
                <h3 className="mt-3 line-clamp-2 min-h-[2.75em] text-sm font-bold text-foreground">
                  <Link
                    href={`/doujin/works/${work.id}`}
                    className="hover:text-accent"
                  >
                    {work.title}
                  </Link>
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  {work.productFormatNormalized ? (
                    <div>
                      <dt className="text-xs text-muted">作品形式</dt>
                      <dd className="mt-0.5">
                        <DoujinProductFormatBadge
                          normalizedFormat={work.productFormatNormalized}
                          size="sm"
                        />
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs text-muted">価格</dt>
                    <dd className="font-bold text-price">
                      {formatDoujinPrice(work.price) ?? "価格情報なし"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-foreground">サークル</dt>
                    <dd>
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
                    </dd>
                  </div>
                  {(work.authorNames ?? []).length > 0 ? (
                    <div>
                      <dt className="text-xs text-foreground">作者</dt>
                      <dd>
                        <DoujinAuthorLinks
                          authorIds={work.authorIds}
                          authorNames={work.authorNames}
                          className="text-sm"
                          variant="link"
                          separator="、"
                        />
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs text-foreground">シリーズ</dt>
                    <dd>
                      <DoujinSeriesLink
                        seriesId={work.seriesId}
                        seriesName={work.seriesName}
                        className="text-sm"
                        variant="link"
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-foreground">ジャンル</dt>
                    <dd>
                      <DoujinGenreLinks
                        genreIds={work.genreIds}
                        genreNames={work.genreNames}
                        className="text-sm"
                        variant="link"
                        separator="、"
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">販売形式</dt>
                    <dd>{work.productFormat ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">販売日</dt>
                    <dd>{work.releaseDate ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">評価</dt>
                    <dd>
                      {work.rating != null
                        ? `${work.rating}（${work.reviewCount ?? 0}件）`
                        : "-"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 space-y-2">
                  <DoujinCompareToggleButton workId={work.id} />
                  {validUrl ? (
                    <a
                      href={affiliateUrl}
                      target="_blank"
                      rel={AFFILIATE_LINK_REL}
                      className={`${workCardCtaBaseClassName} bg-accent text-white hover:bg-accent-hover`}
                    >
                      作品を見る
                    </a>
                  ) : (
                    <span
                      className={`${workCardCtaBaseClassName} cursor-not-allowed border border-border bg-surface text-muted`}
                    >
                      作品ページ準備中
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
