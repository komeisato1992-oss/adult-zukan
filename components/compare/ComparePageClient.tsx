"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CompareMobileView } from "@/components/compare/CompareMobileView";
import { CompareToggleButton } from "@/components/compare/CompareToggleButton";
import type { CompareItem } from "@/components/compare/compare-item-types";
import {
  clearCompareIds,
  readCompareIds,
  setCompareIds,
  subscribeCompareStore,
} from "@/components/compare/compare-store";
import {
  WORK_CARD_VIEW_LABEL,
  workCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";
import { ActressNameLinks } from "@/components/ui/ActressNameLinks";
import { GenreNameLinks } from "@/components/ui/GenreNameLinks";
import { imageCoverClassName } from "@/components/ui/image-cover";
import { ImageLightboxModal } from "@/components/works/ImageLightboxModal";
import {
  COMPARE_GA_EVENTS,
  trackCompareEvent,
} from "@/lib/compare/analytics";
import { buildComparePageHref } from "@/lib/compare/urls";
import { isMissingAdultImage } from "@/lib/works/package-image";

function CompareDescription({
  contentId,
  description,
}: {
  contentId: string;
  description: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!description) return <p className="text-sm text-muted">説明なし</p>;

  return (
    <div>
      <p
        className={`text-sm leading-relaxed text-foreground ${expanded ? "" : "line-clamp-5"}`}
      >
        {description}
      </p>
      {description.length > 120 ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 text-xs text-accent hover:underline"
          aria-expanded={expanded}
          aria-controls={`compare-desc-${contentId}`}
        >
          {expanded ? "閉じる" : "全文を見る"}
        </button>
      ) : null}
    </div>
  );
}

export function ComparePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ids, setIds] = useState<string[]>([]);
  const [items, setItems] = useState<CompareItem[]>([]);
  const [activeImage, setActiveImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [isNarrow, setIsNarrow] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const urlIds = idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 4);
      if (urlIds.length > 0) {
        setCompareIds(urlIds);
      }
    }

    const sync = () => setIds(readCompareIds().slice(0, 4));
    sync();
    return subscribeCompareStore(sync);
  }, [searchParams]);

  useEffect(() => {
    if (ids.length < 2) return;
    const href = buildComparePageHref(ids);
    const currentIds = searchParams.get("ids") ?? "";
    const currentOrdered = currentIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 4);
    if (currentOrdered.join(",") !== ids.join(",")) {
      router.replace(href, { scroll: false });
    }
  }, [ids, router, searchParams]);

  useEffect(() => {
    if (ids.length === 0) {
      setItems([]);
      return;
    }

    let cancelled = false;
    const fetchItems = async () => {
      const response = await fetch(
        `/api/compare?ids=${encodeURIComponent(ids.join(","))}`,
      );
      const json = (await response.json()) as { items: CompareItem[] };
      if (!cancelled) setItems(json.items);
    };
    fetchItems().catch(() => {
      if (!cancelled) setItems([]);
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const isEmpty = ids.length === 0;
  const clearable = useMemo(() => items.length > 0, [items.length]);

  if (isEmpty) {
    return (
      <section className="mt-8 rounded border border-border bg-surface p-8 text-center max-[768px]:pb-2">
        <h2 className="text-lg font-bold text-foreground">
          比較する作品がありません
        </h2>
        <Link
          href="/works"
          className="mt-4 inline-flex rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
        >
          作品一覧へ
        </Link>
      </section>
    );
  }

  if (isNarrow === null) {
    return (
      <section className="mt-6 rounded border border-border bg-surface p-6 text-center text-sm text-muted">
        比較作品を表示しています…
      </section>
    );
  }

  if (isNarrow) {
    return <CompareMobileView items={items} />;
  }

  return (
      /* PC (≥769px): 既存レイアウトを維持 */
      <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted">
              最大4作品を比較できます（現在 {items.length} 件）
            </p>
            {clearable ? (
              <button
                type="button"
                onClick={() => clearCompareIds()}
                className="text-sm text-accent hover:underline"
              >
                比較をクリア
              </button>
            ) : null}
          </div>

          <div
            className={`-mx-4 px-4 sm:mx-0 sm:px-0 ${
              items.length >= 3 ? "overflow-x-auto" : "overflow-x-hidden"
            }`}
          >
            <div
              className={`grid gap-4 ${
                items.length >= 4
                  ? "min-w-[860px] md:grid-cols-4"
                  : items.length === 3
                    ? "min-w-[660px] md:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2"
              }`}
            >
              {items.map((item) => (
                <article
                  key={item.contentId}
                  className="rounded-lg border border-border bg-white p-4 shadow-sm"
                >
                  <Link href={`/works/${item.contentId}`} className="block">
                    {!isMissingAdultImage(item.imageUrl) ? (
                      <Image
                        src={item.imageUrl!}
                        alt={item.title}
                        width={320}
                        height={180}
                        className={`h-auto w-full rounded ${imageCoverClassName}`}
                        loading="lazy"
                        unoptimized
                      />
                    ) : (
                      <div className="aspect-[16/9] rounded bg-surface" />
                    )}
                    <h2 className="mt-3 line-clamp-2 min-h-[2.75rem] text-base font-bold leading-snug text-foreground">
                      {item.title}
                    </h2>
                  </Link>

                  <a
                    href={item.fanzaUrl}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    onClick={() =>
                      trackCompareEvent(COMPARE_GA_EVENTS.fanzaClick, {
                        content_id: item.contentId,
                        source: "compare_page",
                      })
                    }
                    className={`${workCardCtaBaseClassName} mt-3 bg-accent text-white hover:bg-accent-hover`}
                  >
                    {WORK_CARD_VIEW_LABEL}
                  </a>

                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      <span className="text-muted">女優:</span>{" "}
                      <ActressNameLinks names={item.actressNames} />
                    </p>
                    <p>
                      <span className="text-muted">価格:</span>{" "}
                      {item.price ? (
                        <span className="font-bold text-price">{item.price}</span>
                      ) : (
                        "-"
                      )}
                    </p>
                    <p>
                      <span className="text-muted">再生時間:</span>{" "}
                      {item.duration ?? "-"}
                    </p>
                    <p>
                      <span className="text-muted">発売日:</span>{" "}
                      {item.releaseDate ?? "-"}
                    </p>
                    <p>
                      <span className="text-muted">シリーズ:</span>{" "}
                      {item.series ?? "-"}
                    </p>
                    <p>
                      <span className="text-muted">ジャンル:</span>{" "}
                      <GenreNameLinks names={item.genres} />
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="mb-1 text-xs font-medium text-muted">作品説明</p>
                    <CompareDescription
                      contentId={item.contentId}
                      description={item.description}
                    />
                  </div>

                  {item.sampleImages.length > 0 ? (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-medium text-muted">
                        サンプル画像
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {item.sampleImages.map((src, index) => (
                          <button
                            key={src}
                            type="button"
                            onClick={() =>
                              setActiveImage({
                                src,
                                alt: `${item.title} サンプル${index + 1}`,
                              })
                            }
                            className="overflow-hidden rounded border border-border"
                          >
                            <Image
                              src={src}
                              alt={`${item.title} サンプル${index + 1}`}
                              width={120}
                              height={80}
                              className="h-auto w-full object-cover"
                              loading="lazy"
                              unoptimized
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <CompareToggleButton
                      contentId={item.contentId}
                      title={item.title}
                      disableAutoNavigate
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>

          {activeImage ? (
            <ImageLightboxModal
              src={activeImage.src}
              alt={activeImage.alt}
              onClose={() => setActiveImage(null)}
            />
          ) : null}
        </section>
  );
}
