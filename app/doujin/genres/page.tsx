import type { Metadata } from "next";
import Link from "next/link";
import { DoujinEmptyState } from "@/components/doujin/DoujinEmptyState";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import {
  getDoujinGenreList,
  hasDoujinCatalogData,
} from "@/lib/doujin/catalog";
import { doujinPageIntros } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: "ジャンル",
  description: doujinPageIntros.genres,
  robots: { index: false, follow: false, nocache: true },
};

export default function DoujinGenresPage() {
  const hasData = hasDoujinCatalogData();
  const genres = hasData ? getDoujinGenreList() : [];

  return (
    <DoujinPageLayout>
      <DoujinSimplePage title="ジャンル" description={doujinPageIntros.genres}>
        {!hasData ? (
          <DoujinEmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {genres.map((genre) => (
              <Link
                key={genre.id}
                href={`/doujin/genres/${genre.id}`}
                className="rounded-lg border border-border bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
              >
                <span className="text-sm font-semibold text-foreground">
                  {genre.name}
                </span>
                <span className="mt-1.5 block text-xs text-muted">
                  {genre.workCount}作品
                </span>
              </Link>
            ))}
          </div>
        )}
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
