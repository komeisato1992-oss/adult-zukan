import "server-only";

/**
 * 公開条件（第6段階）:
 * package_image あり AND is_available=true AND manual_hidden=false
 * （論理削除は常に非公開）
 */
export function computeWorksPublished(input: {
  packageImage: string | null | undefined;
  isAvailable: boolean;
  manualHidden: boolean;
  deletedAt?: string | null;
}): boolean {
  if (input.deletedAt) return false;
  if (input.manualHidden) return false;
  if (!input.isAvailable) return false;
  const image = input.packageImage?.trim();
  return Boolean(image);
}

export type FanzaTvStatusValue = "active" | "not_available" | "unknown";

export function normalizeFanzaTvStatus(
  value: string | null | undefined,
): FanzaTvStatusValue | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "active" || v === "available" || v === "yes" || v === "true") {
    return "active";
  }
  if (
    v === "not_available" ||
    v === "unavailable" ||
    v === "no" ||
    v === "false"
  ) {
    return "not_available";
  }
  if (v === "unknown" || v === "pending" || v === "unchecked") {
    return "unknown";
  }
  return "unknown";
}

export function isFanzaTvActiveBadge(
  status: string | null | undefined,
): boolean {
  return normalizeFanzaTvStatus(status) === "active";
}
