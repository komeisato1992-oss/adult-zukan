import { createPageMetadata } from "@/lib/seo/metadata";
import { FavoritesClient } from "./FavoritesClient";

export const metadata = createPageMetadata({
  title: "お気に入り",
  description: "お気に入りに登録した作品一覧。",
  path: "/favorites",
  noIndex: true,
});

export default function FavoritesPage() {
  return <FavoritesClient />;
}
