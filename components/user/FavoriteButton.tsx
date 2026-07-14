"use client";

import { useEffect, useState } from "react";
import {
  FAVORITES_CHANGED_EVENT,
  isFavorite,
  toggleFavorite,
} from "@/lib/favorites";

type FavoriteButtonProps = {
  contentId: string;
  title: string;
  className?: string;
  /** 短いラベル（モバイル補助ボタン用） */
  compact?: boolean;
};

export function FavoriteButton({
  contentId,
  title,
  className = "",
  compact = false,
}: FavoriteButtonProps) {
  const [active, setActive] = useState(() => isFavorite(contentId));

  useEffect(() => {
    const sync = () => setActive(isFavorite(contentId));
    sync();
    window.addEventListener(FAVORITES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, sync);
  }, [contentId]);

  function handleClick() {
    const next = toggleFavorite(contentId);
    setActive(next.includes(contentId));
  }

  const label = compact
    ? active
      ? "お気に入り済"
      : "お気に入り"
    : active
      ? "お気に入り済み"
      : "お気に入りに追加";

  const toneClass = active
    ? "border-accent bg-accent-light text-accent"
    : "border-accent/50 bg-white text-accent hover:border-accent hover:bg-accent-light/50";

  const sizeClass = compact
    ? "h-11 min-h-[44px] w-full justify-center rounded-lg border-accent px-2 text-[13px] font-semibold hover:bg-accent-light"
    : "h-10 px-4 text-sm";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        active ? `${title}をお気に入りから削除` : `${title}をお気に入りに追加`
      }
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded border font-medium transition-colors ${sizeClass} ${toneClass} ${className}`.trim()}
    >
      <span aria-hidden="true">{active ? "❤️" : "♡"}</span>
      {label}
    </button>
  );
}
