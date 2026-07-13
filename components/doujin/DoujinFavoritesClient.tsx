"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DoujinWorksGrid } from "@/components/doujin/DoujinWorksGrid";
import {
  DOUJIN_FAVORITES_CHANGED_EVENT,
  getDoujinFavoriteIds,
} from "@/lib/doujin/favorites";
import type { DoujinWork } from "@/lib/doujin/types";

export function DoujinFavoritesClient() {
  const [ids, setIds] = useState<string[]>([]);
  const [works, setWorks] = useState<DoujinWork[]>([]);

  useEffect(() => {
    const sync = () => setIds(getDoujinFavoriteIds());
    sync();
    window.addEventListener(DOUJIN_FAVORITES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DOUJIN_FAVORITES_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (ids.length === 0) {
      setWorks([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/doujin/compare?ids=${encodeURIComponent(ids.join(","))}`)
      .then((response) => response.json())
      .then((json: { items?: DoujinWork[] }) => {
        if (!cancelled) setWorks(json.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setWorks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  if (ids.length === 0) {
    return (
      <div className="rounded border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">お気に入りに登録した同人作品はありません。</p>
        <Link
          href="/doujin/works"
          className="mt-4 inline-flex rounded bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover"
        >
          作品一覧へ
        </Link>
      </div>
    );
  }

  if (works.length === 0) {
    return (
      <p className="text-sm text-muted">作品データを読み込み中、または未取得です。</p>
    );
  }

  return <DoujinWorksGrid works={works} />;
}
