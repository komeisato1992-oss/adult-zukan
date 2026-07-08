"use client";

import { useState } from "react";
import { isFavorite, toggleFavorite } from "@/lib/favorites";

type FavoriteButtonProps = {
  contentId: string;
  title: string;
  className?: string;
};

export function FavoriteButton({ contentId, title, className }: FavoriteButtonProps) {
  const [active, setActive] = useState(() => isFavorite(contentId));

  function handleClick() {
    const next = toggleFavorite(contentId);
    setActive(next.includes(contentId));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={active ? `${title}をお気に入りから削除` : `${title}をお気に入りに追加`}
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
