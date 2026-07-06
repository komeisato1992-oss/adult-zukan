import { NextResponse } from "next/server";
import { isDmmConfigured } from "@/lib/dmm/client";
import {
  DMM_LIST_ITEMS_LIMIT,
  getDmmListItems,
} from "@/lib/dmm/list-items";
import { sanitizeDmmItemResponse } from "@/lib/dmm/sanitize";
import type { DmmItemListResponse } from "@/lib/dmm/types";

export const revalidate = 86400;

function resolveSort(
  sort: string | null,
): "date" | "rank" | "price" | "review" | undefined {
  if (sort === "rank") return "rank";
  if (sort === "new") return "date";
  if (sort === "price") return "price";
  if (sort === "review") return "review";
  return "date";
}

export async function GET(request: Request) {
  if (!isDmmConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message: "作品を取得できませんでした",
        error: "DMM API credentials are not configured",
      },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("q")?.trim() || undefined;
  const sort = resolveSort(searchParams.get("sort"));
  const saleOnly = searchParams.get("sale") === "1";

  try {
    const items = await getDmmListItems({
      limit: DMM_LIST_ITEMS_LIMIT,
      keyword,
      sort,
      saleOnly,
    });

    const response: DmmItemListResponse = {
      result: {
        status: "200",
        result_count: items.length,
        total_count: items.length,
        items,
      },
    };

    return NextResponse.json({
      success: true,
      ...sanitizeDmmItemResponse(response),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "作品を取得できませんでした";

    return NextResponse.json(
      {
        success: false,
        message: "作品を取得できませんでした",
        error: message,
      },
      { status: 500 },
    );
  }
}
