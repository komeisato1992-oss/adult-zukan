"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DOUJIN_FAVORITES_CHANGED_EVENT,
  getDoujinFavoriteIds,
} from "@/lib/doujin/favorites";

export function DoujinFooterFavoritesLink() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(getDoujinFavoriteIds().length);
    sync();
    window.addEventListener(DOUJIN_FAVORITES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DOUJIN_FAVORITES_CHANGED_EVENT, sync);
  }, []);

  return (
    <Link href="/doujin/favorites" className="text-sm text-muted hover:text-accent">
      お気に入り❤️{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}
