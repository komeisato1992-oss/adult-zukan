import type { DmmItem } from "@/lib/dmm/types";
import { getActressNamesFromItem } from "@/lib/dmm/actress-names";
import { getActressDetailPath } from "@/lib/actresses/slug";
import {
  getGenreDetailPath,
  getLabelDetailPath,
  getMakerDetailPath,
  getSeriesDetailPath,
} from "@/lib/entities/paths";
import { formatDmmPriceString } from "@/lib/dmm/format-price";
import {
  formatDmmItemPrice,
  getDmmReleaseDateInfo,
} from "@/lib/dmm/release-date";
import { slugify } from "@/lib/utils";
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
  return getActressNamesFromItem(item);
}

export function getDmmItemPrice(item: DmmItem): string | undefined {
  return formatDmmItemPrice(item);
}

/** 再生時間（DMM volume）。数値のみの場合は「○分」を付与 */
export function getDmmItemVolumeLabel(item: DmmItem): string | undefined {
  const raw = item.volume?.trim();
  if (!raw) return undefined;
  if (/分|時間|:/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `${raw}分`;
  return raw;
}

/** 評価表示（例: ★4.82）。average が無い場合は非表示 */
export function getDmmItemReviewLabel(item: DmmItem): string | undefined {
  const averageRaw = item.review?.average?.trim();
  if (!averageRaw) return undefined;
  const average = Number.parseFloat(averageRaw);
  if (!Number.isFinite(average) || average <= 0) return undefined;
  return `★${average.toFixed(2)}`;
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

export function getDmmItemGenreNameList(item: DmmItem): string[] {
  const genres = item.iteminfo?.genre ?? [];
  return genres.map((genre) => genre.name).filter(Boolean);
}

export function getDmmItemGenreNames(item: DmmItem): string | undefined {
  const names = getDmmItemGenreNameList(item);
  return names.length > 0 ? names.join("、") : undefined;
}

export type DmmInfoLink = {
  label: string;
  href: string;
};

export type DmmInfoRow = {
  label: string;
  value?: string;
  links?: DmmInfoLink[];
  multiline?: boolean;
};

function createEntityLink(
  name: string,
  getPath: (slug: string) => string,
): DmmInfoLink | null {
  const slug = slugify(name);
  if (!slug) return null;
  return { label: name, href: getPath(slug) };
}

function createEntityRow(
  label: string,
  name: string,
  getPath: (slug: string) => string,
): DmmInfoRow {
  const link = createEntityLink(name, getPath);
  return link ? { label, links: [link] } : { label, value: name };
}

function createEntityListRow(
  label: string,
  names: string[],
  getPath: (slug: string) => string,
): DmmInfoRow | null {
  if (names.length === 0) return null;

  const links = names
    .map((name) => createEntityLink(name, getPath))
    .filter((link): link is DmmInfoLink => link !== null);

  if (links.length === 0) {
    return { label, value: names.join("、") };
  }

  return { label, links };
}

export function getDmmInfoRows(
  item: DmmItem,
  description?: string,
): DmmInfoRow[] {
  const releaseDate = getDmmReleaseDateInfo(item);
  const makerName = getDmmItemMakerName(item);
  const labelName = getDmmItemLabelName(item);
  const seriesName = getDmmItemSeriesName(item);
  const actressNames = getDmmItemActressNameList(item);
  const genreNames = getDmmItemGenreNameList(item);

  const volumeLabel = getDmmItemVolumeLabel(item);
  const reviewLabel = getDmmItemReviewLabel(item);
  const priceLabel = getDmmItemPrice(item);

  const rows: Array<DmmInfoRow | null> = [
    { label: "品番", value: item.content_id },
    actressNames.length > 0
      ? {
          label: "女優",
          links: actressNames.map((name) => ({
            label: name,
            href: getActressDetailPath(name),
          })),
        }
      : null,
    makerName ? createEntityRow("メーカー", makerName, getMakerDetailPath) : null,
    labelName ? createEntityRow("レーベル", labelName, getLabelDetailPath) : null,
    seriesName
      ? createEntityRow("シリーズ", seriesName, getSeriesDetailPath)
      : null,
    releaseDate
      ? { label: releaseDate.label, value: releaseDate.value }
      : null,
    volumeLabel ? { label: "収録時間", value: volumeLabel } : null,
    priceLabel ? { label: "価格", value: priceLabel } : null,
    reviewLabel ? { label: "評価", value: reviewLabel } : null,
    createEntityListRow("ジャンル", genreNames, getGenreDetailPath),
    description
      ? { label: "作品説明", value: description, multiline: true }
      : null,
    getDmmDeliveryFormats(item)
      ? { label: "配信形式", value: getDmmDeliveryFormats(item)! }
      : null,
  ];

  return rows.filter((row): row is DmmInfoRow => row !== null);
}
