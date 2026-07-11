import type { DmmCampaign, DmmItem } from "@/lib/dmm/types";
import {
  getSalePriceInfo,
  type SalePriceInfo,
} from "@/lib/dmm/sale-price";

export type WorkSaleInfo = {
  isSale: boolean;
  regularPrice: number | null;
  currentPrice: number | null;
  discountRate: number | null;
  saleEndAt: string | null;
};

function parseCampaignEndTimestamp(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 有効な campaign のうち最も遅い終了日時（ISO文字列） */
export function getActiveCampaignEndAt(
  campaigns: DmmCampaign[] | undefined,
  now = Date.now(),
): string | null {
  if (!campaigns?.length) return null;

  let latestEnd: { iso: string; ts: number } | null = null;

  for (const campaign of campaigns) {
    const endTs = parseCampaignEndTimestamp(campaign.date_end);
    const beginTs = parseCampaignEndTimestamp(campaign.date_begin);

    if (endTs == null) continue;
    if (beginTs != null && beginTs > now) continue;
    if (endTs < now) continue;

    if (!latestEnd || endTs > latestEnd.ts) {
      latestEnd = { iso: campaign.date_end, ts: endTs };
    }
  }

  return latestEnd?.iso ?? null;
}

function hasExpiredCampaignOnly(
  campaigns: DmmCampaign[] | undefined,
  now = Date.now(),
): boolean {
  if (!campaigns?.length) return false;

  let hasAnyEnd = false;

  for (const campaign of campaigns) {
    const endTs = parseCampaignEndTimestamp(campaign.date_end);
    if (endTs == null) continue;
    hasAnyEnd = true;
    if (endTs >= now) return false;
  }

  return hasAnyEnd;
}

function buildFromPriceInfo(
  priceInfo: SalePriceInfo | null,
  saleEndAt: string | null,
  campaigns: DmmCampaign[] | undefined,
  now = Date.now(),
): WorkSaleInfo {
  if (!priceInfo) {
    return {
      isSale: false,
      regularPrice: null,
      currentPrice: null,
      discountRate: null,
      saleEndAt,
    };
  }

  let isSale = true;

  if (saleEndAt) {
    const endTs = parseCampaignEndTimestamp(saleEndAt);
    if (endTs != null && endTs < now) {
      isSale = false;
    }
  } else if (hasExpiredCampaignOnly(campaigns, now)) {
    isSale = false;
  }

  return {
    isSale,
    regularPrice: priceInfo.regularPrice,
    currentPrice: priceInfo.currentPrice,
    discountRate: priceInfo.discountRate,
    saleEndAt,
  };
}

/** セール判定の共通関数（表示・抽出は必ずこちらを使用） */
export function getWorkSaleInfo(
  work: DmmItem,
  now = Date.now(),
): WorkSaleInfo {
  const priceInfo = getSalePriceInfo(work);
  const saleEndAt = getActiveCampaignEndAt(work.campaign, now);
  return buildFromPriceInfo(priceInfo, saleEndAt, work.campaign, now);
}

export function isWorkOnSale(work: DmmItem, now = Date.now()): boolean {
  return getWorkSaleInfo(work, now).isSale;
}
