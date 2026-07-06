import type { DmmItemListResponse } from "@/lib/dmm/types";

export function sanitizeDmmItemResponse(data: DmmItemListResponse) {
  return {
    result: {
      status: data.result.status,
      result_count: data.result.result_count,
      total_count: data.result.total_count,
      items: data.result.items,
    },
  };
}
