"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CompareMobileView } from "@/components/compare/CompareMobileView";
import type { CompareItem } from "@/components/compare/compare-item-types";
import {
  ClampExpandable,
  CompareEntityNameLink,
} from "@/components/compare/compare-table-cells";
import {
  clearCompareIds,
  readCompareIds,
  setCompareIds,
} from "@/components/compare/compare-store";
import {
  WORK_CARD_VIEW_LABEL,
  workCardCtaBaseClassName,
} from "@/components/works/work-card-cta-styles";
import { ActressNameLinks } from "@/components/ui/ActressNameLinks";
import { GenreNameLinks } from "@/components/ui/GenreNameLinks";
import {
  COMPARE_GA_EVENTS,
  trackCompareEvent,
} from "@/lib/compare/analytics";
import { formatPriceYen } from "@/lib/compare/types";
import {
  buildComparePageHref,
  parseCompareIdsParam,
} from "@/lib/compare/urls";

function DesktopPrice({ item }: { item: CompareItem }) {
  const saleLabel =
    item.currentPrice != null ? formatPriceYen(item.currentPrice) : item.price;
  const regularLabel =
    item.regularPrice != null &&
    item.currentPrice != null &&
    item.regularPrice > item.currentPrice
      ? formatPriceYen(item.regularPrice)
      : undefined;

  if (!saleLabel) return <span className="text-muted">—</span>;

  return (
    <p className="flex flex-col gap-0.5">
      <span className="font-bold text-price">{saleLabel}</span>
      {regularLabel ? (
        <span className="text-xs text-muted line-through">{regularLabel}</span>
      ) : null}
    </p>
  );
}

/**
 * 比較ページの正は URL の ids。
 * localStorage は URL に同期する（表示件数・クリア対象と一致させる）。
 */
export function ComparePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [urlIds, setUrlIds] = useState<string[]>([]);
  const [items, setItems] = useState<CompareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isNarrow, setIsNarrow] = useState<boolean | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const fromUrl = parseCompareIdsParam(searchParams.get("ids"));
    if (fromUrl.length > 0) {
      setUrlIds(fromUrl);
      setCompareIds(fromUrl);
      setHydrated(true);
      return;
    }

    // URL が空のときのみ、store → URL へ一度同期して正を URL に寄せる
    if (!hydrated) {
      const stored = readCompareIds();
      if (stored.length > 0) {
        setHydrated(true);
        router.replace(buildComparePageHref(stored), { scroll: false });
        return;
      }
    }

    setUrlIds([]);
    setHydrated(true);
  }, [searchParams, router, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (urlIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const fetchItems = async () => {
      const response = await fetch(
        `/api/compare?ids=${encodeURIComponent(urlIds.join(","))}`,
      );
      const json = (await response.json()) as { items: CompareItem[] };
      if (cancelled) return;
      // URL 順を維持し、取得できた作品だけを同一配列として使う
      const byId = new Map(json.items.map((item) => [item.contentId, item]));
      const ordered = urlIds
        .map((id) => byId.get(id))
        .filter((item): item is CompareItem => Boolean(item));
      setItems(ordered);
      setLoading(false);
    };
    fetchItems().catch(() => {
      if (!cancelled) {
        setItems([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [urlIds, hydrated]);

  const displayCount = items.length;
  const clearable = displayCount > 0;

  function handleClear() {
    clearCompareIds();
    setUrlIds([]);
    setItems([]);
    router.replace("/compare", { scroll: false });
  }

  function handleRemove(contentId: string) {
    const next = items
      .map((item) => item.contentId)
      .filter((id) => id !== contentId);
    setCompareIds(next);
    router.replace(buildComparePageHref(next), { scroll: false });
  }

  const emptyMessage = useMemo(
    () => (
      <section className="mt-8 rounded border border-border bg-surface p-8 text-center max-[768px]:pb-2">
        <h2 className="text-lg font-bold text-foreground">
          比較する作品が選択されていません
        </h2>
        <p className="mt-2 text-sm text-muted">
          作品一覧から比較したい作品を選んでください
        </p>
        <Link
          href="/works"
          className="mt-4 inline-flex rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
        >
          作品一覧へ
        </Link>
      </section>
    ),
    [],
  );

  if (!hydrated || isNarrow === null) {
    return (
      <section className="mt-6 rounded border border-border bg-surface p-6 text-center text-sm text-muted">
        比較作品を表示しています…
      </section>
    );
  }

  if (urlIds.length === 0) {
    return emptyMessage;
  }

  if (loading && items.length === 0) {
    return (
      <section className="mt-6 rounded border border-border bg-surface p-6 text-center text-sm text-muted">
        比較作品を読み込み中...
      </section>
    );
  }

  if (items.length === 0) {
    return emptyMessage;
  }

  if (isNarrow) {
    return <CompareMobileView items={items} />;
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
            <div className="mx-auto flex h-[200px] w-full max-w-[220px] items-center justify-center overflow-hidden rounded bg-surface">
              <Image
                src={item.imageUrl}
                alt={item.title}
                width={220}
                height={200}
                className="h-auto max-h-full w-auto max-w-full object-contain"
                loading="lazy"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded bg-surface text-sm text-muted">
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
          textClassName="font-bold text-foreground"
          toggleClassName="mt-1 text-xs font-medium text-accent hover:underline"
        />
      ),
    },
    {
      key: "price",
      label: "価格",
      render: (item) => <DesktopPrice item={item} />,
    },
    {
      key: "actress",
      label: "女優",
      render: (item) =>
        item.actressNames.length > 0 ? (
          <ActressNameLinks names={item.actressNames} />
        ) : (
          "—"
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
        item.genres.length > 0 ? <GenreNameLinks names={item.genres} /> : "—",
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
          textClassName="text-sm leading-relaxed text-foreground"
          toggleClassName="mt-1 text-xs font-medium text-accent hover:underline"
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
            className="flex h-11 w-full items-center justify-center rounded-md border border-accent text-sm font-bold text-accent hover:bg-accent-light"
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
                  source: "compare_page",
                })
              }
              className={`${workCardCtaBaseClassName} h-11 min-h-11 bg-accent text-white hover:bg-accent-hover`}
            >
              {WORK_CARD_VIEW_LABEL}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => handleRemove(item.contentId)}
            className="w-full py-3 text-center text-sm font-medium text-accent hover:underline"
          >
            比較から外す
          </button>
        </div>
      ),
    },
  ];

  const gridTemplate = `120px repeat(${items.length}, minmax(0, 1fr))`;

  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          最大4作品を比較できます（現在 {displayCount} 件）
        </p>
        {clearable ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-accent hover:underline"
          >
            比較をクリア
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <div
          className="min-w-0 w-full"
          style={{
            display: "grid",
            gridTemplateColumns: gridTemplate,
          }}
        >
          <div className="border-b border-r border-border bg-gray-50 px-3 py-3 text-sm font-bold text-muted">
            項目
          </div>
          {items.map((item, index) => (
            <div
              key={`head-${item.contentId}`}
              className="border-b border-border bg-white px-3 py-3 text-center text-sm font-bold text-foreground"
            >
              作品{index + 1}
            </div>
          ))}

          {rows.map((row, rowIndex) => (
            <div key={row.key} className="contents">
              <div
                className={`border-r border-border px-3 py-3 text-sm font-medium text-muted ${
                  rowIndex % 2 === 0 ? "bg-gray-50" : "bg-gray-100"
                }`}
              >
                {row.label}
              </div>
              {items.map((item) => (
                <div
                  key={`${row.key}-${item.contentId}`}
                  className={`border-b border-border px-3 py-3 text-sm break-words text-foreground ${
                    rowIndex % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"
                  }`}
                >
                  {row.render(item)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {items.length === 1 ? (
        <p className="mt-4 text-sm text-muted">
          もう1作品追加すると比較できます
        </p>
      ) : null}
    </section>
  );
}
