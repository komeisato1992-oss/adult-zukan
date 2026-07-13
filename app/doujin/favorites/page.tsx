import type { Metadata } from "next";
import { DoujinFavoritesClient } from "@/components/doujin/DoujinFavoritesClient";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { doujinPageIntros } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: "お気に入り",
  description: doujinPageIntros.favorites,
  robots: { index: false, follow: false, nocache: true },
};

export default function DoujinFavoritesPage() {
  return (
    <DoujinPageLayout>
      <DoujinSimplePage
        title="お気に入り"
        description={doujinPageIntros.favorites}
      >
        <DoujinFavoritesClient />
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
