"use client";

import { useEffect, useState } from "react";
import {
  isDoujinFavorite,
  toggleDoujinFavorite,
  DOUJIN_FAVORITES_CHANGED_EVENT,
} from "@/lib/doujin/favorites";

type DoujinFavoriteButtonProps = {
  workId: string;
  title: string;
  className?: string;
};

/** 詳細ページ用お気に入り（アダルト図鑑 FavoriteButton 相当） */
export function DoujinFavoriteButton({
  workId,
  title,
  className,
}: DoujinFavoriteButtonProps) {
  const [active, setActive] = useState(() => isDoujinFavorite(workId));

  useEffect(() => {
    const sync = () => {
      const next = isDoujinFavorite(workId);
      setActive((current) => (current === next ? current : next));
    };
    window.addEventListener(DOUJIN_FAVORITES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DOUJIN_FAVORITES_CHANGED_EVENT, sync);
  }, [workId]);

  function handleClick() {
    const next = toggleDoujinFavorite(workId);
    setActive(next.includes(workId));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        active ? `${title}をお気に入りから削除` : `${title}をお気に入りに追加`
      }
      aria-pressed={active}
      className={
        className ??
        `inline-flex h-10 shrink-0 items-center gap-1.5 rounded border px-4 text-sm font-medium transition-colors ${
          active
            ? "border-accent bg-accent-light text-accent"
            : "border-accent/50 bg-white text-accent hover:border-accent hover:bg-accent-light/50"
        }`
      }
    >
      <span aria-hidden="true">{active ? "❤️" : "♡"}</span>
      {active ? "お気に入り済み" : "お気に入りに追加"}
    </button>
  );
}
