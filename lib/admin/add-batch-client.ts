/** クライアント側の一括追加バッチ分割ユーティリティ */

import { ADD_BATCH_SIZE } from "@/lib/admin/import-constants";

export function chunkItems<T>(items: T[], size = ADD_BATCH_SIZE): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function plannedBatchCount(
  total: number,
  size = ADD_BATCH_SIZE,
): number {
  if (total <= 0) return 0;
  return Math.ceil(total / size);
}

export function createAddProcessId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `add-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
