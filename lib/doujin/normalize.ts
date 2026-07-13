import "server-only";

import { parseComparablePrice } from "@/lib/dmm/sale-price";
import {
  DMM_API_AFFILIATE_ID_FALLBACK,
  FANZA_LINK_AFFILIATE_ID,
} from "@/lib/dmm/constants";
import type { DmmItem } from "@/lib/dmm/types";
import { extractDoujinSampleImageUrlsFromApi } from "@/lib/doujin/sample-images";
import type {
  DoujinEntityRef,
  NormalizedDoujinApiItem,
} from "@/lib/doujin/types";

const AUTHOR_KEY_PATTERN =
  /^(authors?|writers?|creators?|artists?|illustrators?|著者|作家|作者|原画家?|シナリオ)$/i;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

export function normalizeDoujinTitle(title: string): string {
  return title
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseDoujinPriceValue(
  value?: string | number | null,
): number | null {
  return parseComparablePrice(value);
}

/** API アイテムから商品説明・作者コメント候補を抽出 */
function pickDoujinDescription(record: Record<string, unknown>): string | undefined {
  const iteminfo = asRecord(record.iteminfo);
  const candidates = [
    record.authorComment,
    record.workComment,
    record.description,
    record.comment,
    record.summary,
    record.story,
    record.caption,
    record.introduction,
    iteminfo?.authorComment,
    iteminfo?.workComment,
    iteminfo?.description,
    iteminfo?.comment,
    iteminfo?.summary,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

function mapEntityList(raw: unknown): DoujinEntityRef[] {
  const result: DoujinEntityRef[] = [];
  for (const entry of asArray(raw)) {
    const record = asRecord(entry);
    if (!record) continue;
    const name = String(record.name ?? "").trim();
    if (!name) continue;
    const idRaw = record.id;
    const externalId =
      idRaw != null && String(idRaw).trim() ? String(idRaw).trim() : undefined;
    const ruby =
      typeof record.ruby === "string" && record.ruby.trim()
        ? record.ruby.trim()
        : undefined;
    result.push({ externalId, name, ruby });
  }
  return result;
}

function extractAuthorsFromItemInfo(
  iteminfo: Record<string, unknown> | null,
): DoujinEntityRef[] {
  if (!iteminfo) return [];

  const authors: DoujinEntityRef[] = [];
  for (const [key, value] of Object.entries(iteminfo)) {
    if (!AUTHOR_KEY_PATTERN.test(key)) continue;
    authors.push(...mapEntityList(value));
  }
  return authors;
}

function extractAuthorsFromItem(item: Record<string, unknown>): DoujinEntityRef[] {
  const fromTop: DoujinEntityRef[] = [];
  for (const [key, value] of Object.entries(item)) {
    if (!AUTHOR_KEY_PATTERN.test(key)) continue;
    fromTop.push(...mapEntityList(value));
  }

  const iteminfo = asRecord(item.iteminfo);
  const fromInfo = extractAuthorsFromItemInfo(iteminfo);
  const merged = [...fromTop, ...fromInfo];

  const seen = new Set<string>();
  return merged.filter((author) => {
    const key = author.externalId
      ? `id:${author.externalId}`
      : `name:${normalizeDoujinTitle(author.name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractSampleImages(item: Record<string, unknown>): string[] {
  // sample_l → sample → sample_s の順で、最初の非空セットのみ採用（混在・推測なし）
  return extractDoujinSampleImageUrlsFromApi(item.sampleImageURL);
}

function sanitizeRawApiItem(item: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(item);
  const redact = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value
        .replace(/api_id=[^&]+/gi, "api_id=REDACTED")
        .replace(/affiliate_id=[^&]+/gi, "affiliate_id=REDACTED");
    }
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === "object") {
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (/api[_-]?id|affiliate[_-]?id|password|secret|token/i.test(k)) {
          next[k] = "REDACTED";
        } else {
          next[k] = redact(v);
        }
      }
      return next;
    }
    return value;
  };
  return redact(clone) as Record<string, unknown>;
}

function buildAffiliateUrl(item: DmmItem): string | undefined {
  if (item.URL) {
    return `https://al.dmm.co.jp/?lurl=${encodeURIComponent(item.URL)}&af_id=${FANZA_LINK_AFFILIATE_ID}&ch=api`;
  }
  if (item.affiliateURL) {
    return item.affiliateURL.replace(
      DMM_API_AFFILIATE_ID_FALLBACK,
      FANZA_LINK_AFFILIATE_ID,
    );
  }
  return undefined;
}

function parseSaleEndAt(item: DmmItem): string | null {
  const campaigns = item.campaign;
  if (!Array.isArray(campaigns) || campaigns.length === 0) return null;
  const end = campaigns
    .map((c) => c.date_end)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  return end ?? null;
}

function parseRating(item: DmmItem): number | null {
  const average = item.review?.average;
  if (average == null) return null;
  const parsed = Number(String(average).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePageCount(volume?: string): number | null {
  if (!volume) return null;
  const digits = volume.replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * API商品を同人図鑑の正規化形へ変換。
 * contentId と title が無い場合は null（スキップ対象）。
 */
export function normalizeDoujinApiItem(
  apiItem: unknown,
  floor: { site: string; service: string; floor: string },
):
  | { ok: true; item: NormalizedDoujinApiItem }
  | { ok: false; reason: string } {
  const record = asRecord(apiItem);
  if (!record) {
    return { ok: false, reason: "item is not an object" };
  }

  const item = record as unknown as DmmItem;
  const contentId = String(item.content_id ?? "").trim();
  const productId = String(item.product_id ?? "").trim();
  const title = String(item.title ?? "").trim();

  if (!contentId && !productId) {
    return { ok: false, reason: "missing content_id/product_id" };
  }
  if (!title) {
    return { ok: false, reason: "missing title" };
  }

  const externalProductId = productId || contentId;
  const resolvedContentId = contentId || productId;
  const iteminfo = asRecord(record.iteminfo);

  const price = parseDoujinPriceValue(item.prices?.price);
  const listPrice = parseDoujinPriceValue(item.prices?.list_price);
  const originalPrice =
    listPrice != null && price != null && listPrice > price
      ? listPrice
      : listPrice ?? price;
  const isSale =
    price != null &&
    originalPrice != null &&
    originalPrice > 0 &&
    price < originalPrice;
  const discountRate =
    isSale && originalPrice
      ? Math.round(((originalPrice - (price ?? 0)) / originalPrice) * 100)
      : null;

  const circles = mapEntityList(iteminfo?.maker ?? record.maker);
  const series = mapEntityList(iteminfo?.series ?? record.series);
  const genres = mapEntityList(iteminfo?.genre ?? record.genre);
  const authors = extractAuthorsFromItem(record);

  // サークル名を作者として重複させない
  const circleNames = new Set(
    circles.map((circle) => normalizeDoujinTitle(circle.name)),
  );
  const filteredAuthors = authors.filter(
    (author) => !circleNames.has(normalizeDoujinTitle(author.name)),
  );

  const image = item.imageURL;

  return {
    ok: true,
    item: {
      externalProductId,
      contentId: resolvedContentId,
      title,
      titleNormalized: normalizeDoujinTitle(title),
      description: pickDoujinDescription(record),
      affiliateUrl: buildAffiliateUrl(item),
      productUrl: item.URL || undefined,
      images: {
        small: image?.small,
        list: image?.list,
        large: image?.large,
      },
      sampleImages: extractSampleImages(record),
      price,
      originalPrice: originalPrice ?? null,
      discountRate,
      isSale,
      saleEndAt: parseSaleEndAt(item),
      releaseDate: item.date ? String(item.date).split(" ")[0] : undefined,
      rating: parseRating(item),
      reviewCount:
        typeof item.review?.count === "number" ? item.review.count : null,
      circles,
      authors: filteredAuthors,
      series,
      genres,
      productFormat:
        typeof record.category_name === "string"
          ? record.category_name
          : typeof record.floor_name === "string"
            ? record.floor_name
            : undefined,
      volume: item.volume,
      pageCount: parsePageCount(item.volume),
      siteCode: floor.site,
      serviceCode: floor.service,
      floorCode: floor.floor,
      rawApiResponse: sanitizeRawApiItem(record),
    },
  };
}
