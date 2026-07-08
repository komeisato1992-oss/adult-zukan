"use client";

import Link from "next/link";
import { FavoriteNavLabel } from "@/components/user/FavoriteNavLabel";

export function FooterFavoritesLink() {
  return (
    <Link href="/favorites" className="text-sm text-muted hover:text-accent">
      <FavoriteNavLabel />
    </Link>
  );
}
