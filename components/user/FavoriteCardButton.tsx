"use client";

import { memo, useEffect, useState } from "react";
import {
  FAVORITES_CHANGED_EVENT,
  isFavorite,
  toggleFavorite,
} from "@/lib/favorites";

type FavoriteCardButtonProps = {
  contentId: string;
  title: string;
};

function FavoriteCardButtonInner({ contentId, title }: FavoriteCardButtonProps) {
  const [active, setActive] = useState(() => isFavorite(contentId));
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = isFavorite(contentId);
      setActive((current) => (current === next ? current : next));
    };
    window.addEventListener(FAVORITES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, sync);
  }, [contentId]);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const next = toggleFavorite(contentId);
    const isActive = next.includes(contentId);
    setActive((current) => (current === isActive ? current : isActive));
    setPopping(true);
    window.setTimeout(() => setPopping(false), 250);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={active ? `${title}をお気に入りから削除` : `${title}をお気に入りに追加`}
      aria-pressed={active}
      className={`absolute top-2 left-2 z-20 p-1 touch-manipulation text-3xl leading-none transition-transform duration-200 hover:scale-110 active:scale-95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] ${
        active ? "text-red-500" : "text-white"
      } ${popping ? "scale-[1.15]" : ""}`}
    >
      <span aria-hidden="true">{active ? "♥" : "♡"}</span>
    </button>
  );
}

export const FavoriteCardButton = memo(
  FavoriteCardButtonInner,
  (prev, next) =>
    prev.contentId === next.contentId && prev.title === next.title,
);
