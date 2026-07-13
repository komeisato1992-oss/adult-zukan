"use client";

import { memo, useEffect, useState } from "react";
import {
  DOUJIN_FAVORITES_CHANGED_EVENT,
  isDoujinFavorite,
  toggleDoujinFavorite,
} from "@/lib/doujin/favorites";

type DoujinFavoriteCardButtonProps = {
  workId: string;
  title: string;
};

function DoujinFavoriteCardButtonInner({
  workId,
  title,
}: DoujinFavoriteCardButtonProps) {
  const [active, setActive] = useState(() => isDoujinFavorite(workId));
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = isDoujinFavorite(workId);
      setActive((current) => (current === next ? current : next));
    };
    window.addEventListener(DOUJIN_FAVORITES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DOUJIN_FAVORITES_CHANGED_EVENT, sync);
  }, [workId]);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const next = toggleDoujinFavorite(workId);
    const isActive = next.includes(workId);
    setActive((current) => (current === isActive ? current : isActive));
    setPopping(true);
    window.setTimeout(() => setPopping(false), 250);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        active ? `${title}をお気に入りから削除` : `${title}をお気に入りに追加`
      }
      aria-pressed={active}
      className={`absolute top-2 right-2 z-20 p-1 touch-manipulation text-3xl leading-none transition-transform duration-200 hover:scale-110 active:scale-95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] ${
        active ? "text-accent" : "text-white"
      } ${popping ? "scale-[1.15]" : ""}`}
    >
      <span aria-hidden="true">{active ? "♥" : "♡"}</span>
    </button>
  );
}

export const DoujinFavoriteCardButton = memo(
  DoujinFavoriteCardButtonInner,
  (prev, next) => prev.workId === next.workId && prev.title === next.title,
);
