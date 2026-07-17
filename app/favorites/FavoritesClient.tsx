"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { DmmCatalogWorksGrid } from "@/components/works/DmmCatalogWorksGrid";
import {
  FAVORITES_CHANGED_EVENT,
  FAVORITES_STORAGE_KEY,
  getFavoriteIds,
} from "@/lib/favorites";
import type { DmmItem } from "@/lib/dmm/types";

type FavoritesWorksResponse = {
  items: DmmItem[];
  requestedCount?: number;
  missingIds?: string[];
};

export function FavoritesClient() {
  const [items, setItems] = useState<DmmItem[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const load = useCallback(async () => {
    const ids = getFavoriteIds();
    setSavedCount(ids.length);
    setHydrated(true);

    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/favorites/works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        setItems([]);
        return;
      }

      const data = (await response.json()) as FavoritesWorksResponse;
      const nextItems = data.items ?? [];
      // LocalStorage の順を維持（API も順維持だが念のため content_id で並べ替え）
      const byId = new Map(
        nextItems.map((item) => [item.content_id.trim().toLowerCase(), item]),
      );
      const ordered: DmmItem[] = [];
      const used = new Set<string>();
      for (const id of ids) {
        const key = id.trim().toLowerCase();
        const hit =
          byId.get(key) ??
          nextItems.find(
            (item) =>
              item.content_id.trim().toLowerCase() === key ||
              item.product_id?.trim().toLowerCase() === key,
          );
        if (!hit) continue;
        const contentKey = hit.content_id.trim().toLowerCase();
        if (used.has(contentKey)) continue;
        used.add(contentKey);
        ordered.push(hit);
      }
      // API 側で解決できたが ID 照合できなかった分も末尾に足す
      for (const item of nextItems) {
        const contentKey = item.content_id.trim().toLowerCase();
        if (used.has(contentKey)) continue;
        used.add(contentKey);
        ordered.push(item);
      }
      setItems(ordered);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    function handleStorage(event: StorageEvent) {
      if (event.key === FAVORITES_STORAGE_KEY || event.key === null) {
        void load();
      }
    }

    function handleFavoritesChanged() {
      void load();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged);
    };
  }, [load]);

  const displayCount = items.length;
  const pageTitle =
    !hydrated || loading
      ? savedCount > 0
        ? `お気に入り作品一覧（${savedCount}）`
        : "お気に入り作品一覧"
      : displayCount > 0
        ? `お気に入り作品一覧（${displayCount}）`
        : "お気に入り作品一覧";

  const showPartialNotice =
    hydrated &&
    !loading &&
    savedCount > displayCount &&
    displayCount > 0;

  return (
    <PageLayout>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: pageTitle },
        ]}
      />
      <header className="mt-4 mb-8">
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          {pageTitle}
        </h1>
        <p className="mt-3 text-sm text-muted">
          お気に入りに登録した作品一覧です。データはブラウザのLocalStorageに保存されます。
        </p>
        {showPartialNotice ? (
          <p className="mt-2 text-xs text-muted">
            {savedCount}件中{displayCount}件を表示
          </p>
        ) : null}
      </header>

      {loading || !hydrated ? (
        <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
          読み込み中…
        </p>
      ) : items.length > 0 ? (
        <DmmCatalogWorksGrid
          items={items}
          applyDisplayableFilter={false}
        />
      ) : (
        <div className="rounded-lg border border-accent/20 bg-accent-light/40 p-8 text-center">
          <p className="text-sm text-muted">お気に入り作品がありません</p>
          <Link
            href="/works"
            prefetch
            className="mt-6 inline-flex h-11 min-w-[160px] items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            作品を探す
          </Link>
        </div>
      )}
    </PageLayout>
  );
}
