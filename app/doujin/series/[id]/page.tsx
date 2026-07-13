import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { DoujinWorksGrid } from "@/components/doujin/DoujinWorksGrid";
import {
  getDoujinSeriesById,
  getDoujinWorksBySeriesId,
} from "@/lib/doujin/catalog";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: "シリーズ詳細",
  robots: { index: false, follow: false, nocache: true },
};

export default async function DoujinSeriesDetailPage({ params }: PageProps) {
  const { id } = await params;
  const series = getDoujinSeriesById(id);
  if (!series) notFound();
  const works = getDoujinWorksBySeriesId(id);

  return (
    <DoujinPageLayout>
      <DoujinSimplePage
        title={series.name}
        description={`シリーズ「${series.name}」の同人作品一覧です。`}
      >
        <DoujinWorksGrid works={works} />
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
