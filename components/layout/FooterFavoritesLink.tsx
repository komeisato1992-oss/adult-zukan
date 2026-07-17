"use client";

import Link from "next/link";
import { FavoriteNavLabel } from "@/components/user/FavoriteNavLabel";

type FooterFavoritesLinkProps = {
  className?: string;
};

export function FooterFavoritesLink({
  className = "text-sm text-muted hover:text-accent",
}: FooterFavoritesLinkProps) {
  return (
    <Link href="/favorites" className={className}>
      <FavoriteNavLabel />
    </Link>
  );
}
