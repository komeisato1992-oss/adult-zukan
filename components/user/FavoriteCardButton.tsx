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
      className={`absolute right-2 top-2 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/90 bg-white/95 shadow-md touch-manipulation transition-transform duration-200 ease-out hover:scale-110 hover:bg-white hover:shadow-lg ${
        popping ? "scale-[1.2]" : "scale-100"
      }`}
    >
      <span className="text-[21px] leading-none" aria-hidden="true">
        {active ? "❤️" : "🤍"}
      </span>
    </button>
  );
}

export const FavoriteCardButton = memo(
  FavoriteCardButtonInner,
  (prev, next) =>
    prev.contentId === next.contentId && prev.title === next.title,
);
