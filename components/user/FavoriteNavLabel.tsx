"use client";

import { useEffect, useState } from "react";
import {
  FAVORITES_CHANGED_EVENT,
  FAVORITES_STORAGE_KEY,
  getFavoriteIds,
} from "@/lib/favorites";

function readFavoriteCount(): number {
  return getFavoriteIds().length;
}

export function FavoriteNavLabel() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(readFavoriteCount());
    const onStorage = (event: StorageEvent) => {
      if (event.key === FAVORITES_STORAGE_KEY || event.key === null) {
        sync();
      }
    };

    sync();
    window.addEventListener(FAVORITES_CHANGED_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (count > 0) {
    return <>お気に入り（{count}）</>;
  }

  return <>❤️ お気に入り</>;
}
