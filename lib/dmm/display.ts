import type { DmmItem } from "@/lib/dmm/types";
import { formatDmmPriceString } from "@/lib/dmm/format-price";
import {
  formatDmmItemPrice,
  getDmmReleaseDateInfo,
} from "@/lib/dmm/release-date";
import { getValidImageUrl } from "@/lib/works";

export { getDmmSampleMovieUrl } from "@/lib/dmm/sample-movie";

export function getDmmItemImageUrl(item: DmmItem): string | undefined {
  return getValidImageUrl(item, ["large", "small", "list"]);
}

/** 一覧用：large または list 画像 */
export function getDmmListItemImageUrl(item: DmmItem): string | undefined {
  return getValidImageUrl(item, ["large", "list"]);
}

export function getDmmItemMakerName(item: DmmItem): string | undefined {
  return item.maker?.[0]?.name ?? item.iteminfo?.maker?.[0]?.name;
}

export function getDmmItemLabelName(item: DmmItem): string | undefined {
  return item.label?.[0]?.name ?? item.iteminfo?.label?.[0]?.name;
}

export function getDmmItemSeriesName(item: DmmItem): string | undefined {
  return item.series?.[0]?.name ?? item.iteminfo?.series?.[0]?.name;
}

export function getDmmItemActressNames(item: DmmItem): string | undefined {
  const names = getDmmItemActressNameList(item);
  return names.length > 0 ? names.join("、") : undefined;
}

export function getDmmItemActressNameList(item: DmmItem): string[] {
  const actresses = item.actress ?? item.iteminfo?.actress ?? [];
  return actresses.map((actress) => actress.name).filter(Boolean);
}

export function getDmmItemPrice(item: DmmItem): string | undefined {
  return formatDmmItemPrice(item);
}

export function getDmmSampleImages(item: DmmItem): string[] {
  const sample = item.sampleImageURL;
  if (!sample) return [];

  const images =
    sample.sample_l?.image ??
    sample.sample?.image ??
    sample.sample_s?.image ??
    [];

  return images.filter(Boolean);
}

const DELIVERY_LABELS: Record<string, string> = {
  download: "ダウンロード",
  hd: "HD",
  "4k": "4K",
  "8k": "8K",
  iosdl: "iOS",
  androiddl: "Android",
  stream: "ストリーミング",
};

export function getDmmDeliveryFormats(item: DmmItem): string | undefined {
  const deliveries = item.prices?.deliveries?.delivery;
  if (!deliveries?.length) return undefined;

  const formats = deliveries.map((delivery) => {
    const label = DELIVERY_LABELS[delivery.type] ?? delivery.type.toUpperCase();
    return `${label} ${formatDmmPriceString(delivery.price)}`;
  });

  return formats.join(" / ");
}

export function getDmmReleaseDate(item: DmmItem): string | undefined {
  return getDmmReleaseDateInfo(item)?.value;
}

export type DmmInfoRow = {
  label: string;
  value: string;
};

export function getDmmInfoRows(item: DmmItem): DmmInfoRow[] {
  const releaseDate = getDmmReleaseDateInfo(item);

  const rows: Array<DmmInfoRow | null> = [
    { label: "品番", value: item.content_id },
    getDmmItemMakerName(item)
      ? { label: "メーカー", value: getDmmItemMakerName(item)! }
      : null,
    getDmmItemLabelName(item)
      ? { label: "レーベル", value: getDmmItemLabelName(item)! }
      : null,
    getDmmItemSeriesName(item)
      ? { label: "シリーズ", value: getDmmItemSeriesName(item)! }
      : null,
    getDmmItemActressNames(item)
      ? { label: "女優", value: getDmmItemActressNames(item)! }
      : null,
    getDmmItemPrice(item)
      ? { label: "価格", value: getDmmItemPrice(item)! }
      : null,
    getDmmDeliveryFormats(item)
      ? { label: "配信形式", value: getDmmDeliveryFormats(item)! }
      : null,
    releaseDate
      ? { label: releaseDate.label, value: releaseDate.value }
      : null,
  ];

  return rows.filter((row): row is DmmInfoRow => row !== null);
}
