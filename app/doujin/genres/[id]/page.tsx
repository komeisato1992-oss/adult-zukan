import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DoujinPageLayout } from "@/components/doujin/DoujinPageLayout";
import { DoujinSimplePage } from "@/components/doujin/DoujinSimplePage";
import { DoujinWorksGrid } from "@/components/doujin/DoujinWorksGrid";
import {
  getDoujinGenreById,
  getDoujinWorksByGenreId,
} from "@/lib/doujin/catalog";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: "ジャンル詳細",
  robots: { index: false, follow: false, nocache: true },
};

export default async function DoujinGenreDetailPage({ params }: PageProps) {
  const { id } = await params;
  const genre = getDoujinGenreById(id);
  if (!genre) notFound();
  const works = getDoujinWorksByGenreId(id);

  return (
    <DoujinPageLayout>
      <DoujinSimplePage
        title={genre.name}
        description={`ジャンル「${genre.name}」の同人作品一覧です。`}
      >
        <DoujinWorksGrid works={works} />
      </DoujinSimplePage>
    </DoujinPageLayout>
  );
}
