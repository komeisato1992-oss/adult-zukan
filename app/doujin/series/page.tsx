import type { Metadata } from "next";
import Link from "next/link";
import { DoujinEmptyState } from "@/components/doujin/DoujinEmptyState";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import {
  getDoujinSeriesList,
  hasDoujinCatalogData,
} from "@/lib/doujin/catalog";
import { doujinPageIntros } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: "シリーズ",
  description: doujinPageIntros.series,
  robots: { index: false, follow: false, nocache: true },
};

export default function DoujinSeriesPage() {
  const hasData = hasDoujinCatalogData();
  const series = hasData ? getDoujinSeriesList() : [];

  return (
    <DoujinPageLayout>
      <DoujinSimplePage title="シリーズ" description={doujinPageIntros.series}>
        {!hasData ? (
          <DoujinEmptyState />
        ) : series.length === 0 ? (
          <DoujinEmptyState
            title="シリーズ情報のある作品はまだありません"
            description="APIにシリーズがある作品が取得されると表示されます。"
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {series.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/doujin/series/${row.id}`}
                  className="block rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                >
                  {row.name}
                  <span className="mt-1 block text-xs text-muted">
                    {row.workCount}作品
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
