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
};

export function FavoritesClient() {
  const [items, setItems] = useState<DmmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteCount, setFavoriteCount] = useState(0);

  const load = useCallback(async () => {
    const ids = getFavoriteIds();
    setFavoriteCount(ids.length);

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
      setItems(data.items ?? []);
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

  const pageTitle =
    favoriteCount > 0 ? `お気に入り作品一覧（${favoriteCount}）` : "お気に入り作品一覧";

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
      </header>

      {loading ? (
        <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
          読み込み中…
        </p>
      ) : items.length > 0 ? (
        <DmmCatalogWorksGrid items={items} />
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
