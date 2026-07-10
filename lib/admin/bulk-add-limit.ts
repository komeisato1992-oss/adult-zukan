import {
  IMPORT_BULK_ADD_ABSOLUTE_MAX,
  IMPORT_BULK_ADD_DEFAULT,
  IMPORT_BULK_ADD_OPTIONS,
} from "@/lib/admin/import-constants";

export type BulkAddLimitChoice =
  | (typeof IMPORT_BULK_ADD_OPTIONS)[number]
  | "all";

export function resolveBulkAddLimit(
  addLimit: unknown,
  selectedCount: number,
): number {
  if (selectedCount <= 0) return 0;

  if (addLimit === "all") {
    return Math.min(selectedCount, IMPORT_BULK_ADD_ABSOLUTE_MAX);
  }

  const requestedLimit = Number(addLimit);
  return Math.min(
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? requestedLimit
      : IMPORT_BULK_ADD_DEFAULT,
    IMPORT_BULK_ADD_ABSOLUTE_MAX,
    selectedCount,
  );
}

export function formatBulkAddLimitOptionLabel(
  choice: BulkAddLimitChoice,
  selectedCount: number,
): string {
  if (choice === "all") {
    const count = Math.min(selectedCount, IMPORT_BULK_ADD_ABSOLUTE_MAX);
    return `選択中すべて（${count}件）`;
  }

  return `${choice}件`;
}

export function buildBulkAddButtonLabel(addCount: number): string {
  if (addCount <= 0) {
    return "選択した作品を一括追加";
  }

  return `選択した${addCount}件を一括追加`;
}
