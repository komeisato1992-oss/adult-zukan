"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getFavorites } from "@/lib/client-storage";

export function FavoritesClient() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  return (
    <PageLayout showSidebar={false}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "お気に入り" },
        ]}
      />
      <header className="mt-4 mb-8">
        <h1 className="border-l-4 border-accent pl-3 text-2xl font-bold text-foreground">
          お気に入り
        </h1>
        <p className="mt-3 text-sm text-muted">
          お気に入りに登録した作品一覧です。データはブラウザのLocalStorageに保存されます。
        </p>
      </header>

      {favorites.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {favorites.map((slug) => (
            <li key={slug}>
              <Link
                href={`/works/${slug}`}
                className="block px-4 py-3 text-sm hover:bg-surface"
              >
                {slug}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded border border-border bg-surface p-8 text-center text-sm text-muted">
          お気に入りに登録された作品はありません。作品ページの「お気に入り」ボタンから追加できます。
        </p>
      )}
    </PageLayout>
  );
}
