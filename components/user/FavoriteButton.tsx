"use client";

import { useEffect, useState } from "react";
import { isFavorite, toggleFavorite } from "@/lib/client-storage";

type FavoriteButtonProps = {
  slug: string;
  title: string;
  className?: string;
};

export function FavoriteButton({ slug, title, className }: FavoriteButtonProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isFavorite(slug));
  }, [slug]);

  function handleClick() {
    const next = toggleFavorite(slug);
    setActive(next.includes(slug));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={active ? `${title}をお気に入りから削除` : `${title}をお気に入りに追加`}
      aria-pressed={active}
      className={
        className ??
        "inline-flex h-10 items-center gap-2 rounded border border-border px-4 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
      }
    >
      <span aria-hidden="true">{active ? "★" : "☆"}</span>
      {active ? "お気に入り済み" : "お気に入り"}
    </button>
  );
}
