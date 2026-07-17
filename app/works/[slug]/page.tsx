import { notFound } from "next/navigation";
import { DmmWorkDetailView } from "@/components/works/DmmWorkDetailView";
import { UnavailableWorkDetailView } from "@/components/works/UnavailableWorkDetailView";
import { getLimitedWorkStaticParams } from "@/lib/dmm/generate-static-params";
import { getPublicWorkDetailByCid } from "@/lib/dmm/get-work";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
  getDmmItemMakerName,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import { resolveDmmItemDescription } from "@/lib/dmm/resolve-description";
import { createPageMetadata } from "@/lib/seo/metadata";
import { createWorkDescription } from "@/lib/seo/descriptions";
import { createWorkTitle } from "@/lib/seo/titles";

/** 作品詳細 ISR: 価格・セール反映のため 10分（DB live status と整合） */
export const revalidate = 600;

export const dynamicParams = true;

type WorkDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getLimitedWorkStaticParams();
}

export async function generateMetadata({ params }: WorkDetailPageProps) {
  const { slug } = await params;
  // URL パラメータは cid（content_id）として扱う
  const result = await getPublicWorkDetailByCid(slug);

  if (result.status === "not_found") {
    notFound();
  }

  const { item } = result;

  if (result.status === "unavailable") {
    return createPageMetadata({
      title: "この作品は現在販売されていません",
      description:
        "この作品はFANZAでの販売を確認できないため、現在一覧には掲載していません。",
      path: `/works/${item.content_id}`,
      canonicalPath: `/works/${item.content_id}`,
      noIndex: true,
      absoluteTitle: true,
      ogImage: getDmmItemImageUrl(item),
    });
  }

  const actressNames = getDmmItemActressNameList(item);
  const makerName = getDmmItemMakerName(item);
  const price = getDmmItemPrice(item);
  const imageUrl = getDmmItemImageUrl(item);
  const description = await resolveDmmItemDescription(item);

  return createPageMetadata({
    title: createWorkTitle(item.title),
    description: createWorkDescription({
      title: item.title,
      description,
      actressNames,
      makerName,
      price,
    }),
    path: `/works/${item.content_id}`,
    ogType: "article",
    absoluteTitle: true,
    ogImage: imageUrl,
  });
}

export default async function WorkDetailPage({ params }: WorkDetailPageProps) {
  const { slug } = await params;
  // 正式な作品識別子: works.cid（URL の /works/[slug] は cid）
  const result = await getPublicWorkDetailByCid(slug);

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "unavailable") {
    return <UnavailableWorkDetailView item={result.item} />;
  }

  return <DmmWorkDetailView item={result.item} />;
}
