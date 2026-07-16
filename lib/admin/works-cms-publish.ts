import "server-only";

import { hasDisplayableAdultImage } from "@/lib/works/image-status";

/**
 * 公開条件:
 * image_status=ok（未判定時は URL フォールバック）AND is_available AND NOT manual_hidden
 * （論理削除は常に非公開）
 */
export function computeWorksPublished(input: {
  packageImage: string | null | undefined;
  imageStatus?: string | null;
  isAvailable: boolean;
  manualHidden: boolean;
  deletedAt?: string | null;
}): boolean {
  if (input.deletedAt) return false;
  if (input.manualHidden) return false;
  if (!input.isAvailable) return false;
  return hasDisplayableAdultImage({
    imageStatus: input.imageStatus,
    packageImage: input.packageImage,
  });
}

/** works.fanza_tv_status の正規値。legacy: active / not_available も受理 */
export type FanzaTvStatusValue = "available" | "unavailable" | "unknown";

export function normalizeFanzaTvStatus(
  value: string | null | undefined,
): FanzaTvStatusValue | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "active" || v === "available" || v === "yes" || v === "true") {
    return "available";
  }
  if (
    v === "not_available" ||
    v === "unavailable" ||
    v === "no" ||
    v === "false"
  ) {
    return "unavailable";
  }
  if (v === "unknown" || v === "pending" || v === "unchecked") {
    return "unknown";
  }
  return "unknown";
}

export function isFanzaTvActiveBadge(
  status: string | null | undefined,
): boolean {
  return normalizeFanzaTvStatus(status) === "available";
}
