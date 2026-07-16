import type { DmmItem } from "@/lib/dmm/types";
import { hasValidPackageImage } from "@/lib/works/package-image";

export const FANZA_UNAVAILABLE_HIDE_AFTER_MS = 24 * 60 * 60 * 1000;
export const FANZA_NOT_FOUND_HIDE_THRESHOLD = 3;

export type AvailabilityStatus =
  | "available"
  | "temporarily_unconfirmed"
  | "unavailable";

export function getWorkIsActive(work: DmmItem): boolean {
  if (work.isActive === false) return false;
  if (work.hiddenReason === "manual") return false;
  return getAvailabilityStatus(work) !== "unavailable";
}

export function getAvailabilityStatus(work: DmmItem): AvailabilityStatus {
  if (work.availabilityStatus) {
    return work.availabilityStatus;
  }

  if (work.availability === "unavailable") {
    return "unavailable";
  }

  return "available";
}

export function getConsecutiveNotFoundCount(work: DmmItem): number {
  return (
    work.consecutiveNotFoundCount ??
    work.consecutiveFetchFailures ??
    0
  );
}

/** 一覧・検索・サイトマップ等の公開表示対象か */
export function isWorkPubliclyVisible(work: DmmItem): boolean {
  if (!hasValidPackageImage(work)) return false;
  return getWorkIsActive(work) && getAvailabilityStatus(work) !== "unavailable";
}

export function filterPublicCatalogWorks(items: DmmItem[]): DmmItem[] {
  return items.filter(isWorkPubliclyVisible);
}

/** 販売終了詳細ページ（noindex）を表示すべきか */
export function shouldShowUnavailableDetailPage(work: DmmItem): boolean {
  return !isWorkPubliclyVisible(work);
}

export function shouldNoindexUnavailableWork(work: DmmItem): boolean {
  return shouldShowUnavailableDetailPage(work);
}
