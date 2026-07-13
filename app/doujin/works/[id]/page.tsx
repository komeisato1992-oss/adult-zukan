import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DoujinWorkDetailView } from "@/components/doujin/DoujinWorkDetailView";
import { getDoujinWorkById } from "@/lib/doujin/catalog";
import { getDoujinWorkMetadataDescription } from "@/lib/doujin/work-detail";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const work = getDoujinWorkById(id);

  if (!work) {
    return {
      title: "作品が見つかりません",
      robots: {
        index: false,
        follow: false,
        nocache: true,
        noarchive: true,
      },
    };
  }

  return {
    title: work.title,
    description: getDoujinWorkMetadataDescription(work),
    robots: {
      index: false,
      follow: false,
      nocache: true,
      noarchive: true,
    },
  };
}

export default async function DoujinWorkDetailPage({ params }: PageProps) {
  const { id } = await params;
  const work = getDoujinWorkById(id);
  if (!work) notFound();

  return <DoujinWorkDetailView work={work} />;
}
