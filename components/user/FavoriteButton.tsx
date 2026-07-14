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
};

export function FavoriteButton({
  contentId,
  title,
  className = "",
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

  const label = active ? "お気に入り登録済み" : "お気に入りに追加";

  const toneClass = active
    ? "border-accent bg-accent-light text-accent"
    : "border-accent/50 bg-white text-accent hover:border-accent hover:bg-accent-light/50";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        active ? `${title}をお気に入りから削除` : `${title}をお気に入りに追加`
      }
      aria-pressed={active}
      className={`inline-flex h-11 min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-[13px] font-semibold transition-colors ${toneClass} ${className}`.trim()}
    >
      <span aria-hidden="true">{active ? "❤️" : "♡"}</span>
      {label}
    </button>
  );
}
