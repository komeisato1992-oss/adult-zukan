import { NextResponse } from "next/server";
import { getCatalogWorks } from "@/lib/catalog";
import {
  getDmmItemActressNameList,
  getDmmItemGenreNameList,
  getDmmItemImageUrl,
  getDmmItemMakerName,
  getDmmItemPrice,
  getDmmItemSeriesName,
  getDmmSampleImages,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import { getDmmReleaseDateInfo } from "@/lib/dmm/release-date";

function pickDescription(item: {
  description?: string;
  comment?: string;
  sampleImageURL?: { sampleImageComment?: string };
}) {
  return (
    item.description?.trim() ||
    item.comment?.trim() ||
    item.sampleImageURL?.sampleImageComment?.trim() ||
    ""
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (ids.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const catalog = await getCatalogWorks();
  const byId = new Map(catalog.map((item) => [item.content_id, item]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => {
      const release = getDmmReleaseDateInfo(item);
      return {
        contentId: item.content_id,
        title: item.title,
        imageUrl: getDmmItemImageUrl(item),
        actressNames: getDmmItemActressNameList(item),
        makerName: getDmmItemMakerName(item),
        price: getDmmItemPrice(item),
        releaseDate: release?.value,
        duration: item.volume?.trim() ? `${item.volume}分` : undefined,
        genres: getDmmItemGenreNameList(item),
        series: getDmmItemSeriesName(item),
        description: pickDescription(item),
        sampleImages: getDmmSampleImages(item).slice(0, 5),
        fanzaUrl: getDmmFanzaUrl(item),
      };
    });

  return NextResponse.json({ items });
}
