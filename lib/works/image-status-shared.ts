/**
 * image_status の純関数ヘルパー（client / server 共用）。
 * 画像GET判定は lib/works/image-status.ts（server-only）側。
 */
import {
  hasValidPackageImage,
  type PackageImageSource,
} from "@/lib/works/package-image";

export const ADULT_IMAGE_STATUS = {
  ok: "ok",
  nowPrinting: "now_printing",
  fetchFailed: "fetch_failed",
} as const;

export type AdultImageStatus =
  (typeof ADULT_IMAGE_STATUS)[keyof typeof ADULT_IMAGE_STATUS];

export function isAdultImageStatusOk(
  status: string | null | undefined,
): boolean {
  return status === ADULT_IMAGE_STATUS.ok;
}

export function isAdultImageStatusMissing(
  status: string | null | undefined,
): boolean {
  return (
    status === ADULT_IMAGE_STATUS.nowPrinting ||
    status === ADULT_IMAGE_STATUS.fetchFailed
  );
}

/**
 * 公開・管理の表示可否。
 * image_status があればそれを優先。未判定（null）の旧データのみ URL ヒューリスティックへフォールバック。
 */
export function hasDisplayableAdultImage(input: {
  imageStatus?: string | null;
  packageImage?: PackageImageSource;
}): boolean {
  if (isAdultImageStatusOk(input.imageStatus)) return true;
  if (isAdultImageStatusMissing(input.imageStatus)) return false;
  return hasValidPackageImage(input.packageImage);
}
