import type { Metadata } from "next";
import Link from "next/link";
import { DoujinEmptyState } from "@/components/doujin/DoujinEmptyState";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import {
  getDoujinCircleList,
  hasDoujinCatalogData,
} from "@/lib/doujin/catalog";
import { doujinPageIntros } from "@/lib/doujin/site-config";

export const metadata: Metadata = {
  title: "サークル",
  description: doujinPageIntros.circles,
  robots: { index: false, follow: false, nocache: true },
};

export default function DoujinCirclesPage() {
  const hasData = hasDoujinCatalogData();
  const circles = hasData ? getDoujinCircleList() : [];

  return (
    <DoujinPageLayout>
      <DoujinSimplePage title="サークル" description={doujinPageIntros.circles}>
        {!hasData ? (
          <DoujinEmptyState />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {circles.map((circle) => (
              <li key={circle.id}>
                <Link
                  href={`/doujin/circles/${circle.id}`}
                  className="block rounded-lg border border-border bg-white px-4 py-3 transition-colors hover:border-accent hover:text-accent"
                >
                  <p className="text-sm font-medium">{circle.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {circle.workCount}作品
                    {circle.representativeWork
                      ? ` / 代表: ${circle.representativeWork.title}`
                      : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
