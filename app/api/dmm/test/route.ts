import { NextResponse } from "next/server";
import { fetchItem, isDmmConfigured } from "@/lib/dmm/client";
import { filterValidJacketItems } from "@/lib/dmm/filter";
import { sanitizeDmmItemResponse } from "@/lib/dmm/sanitize";
import type { DmmItemListResponse } from "@/lib/dmm/types";

export const dynamic = "force-dynamic";

function sanitizeTestResponse(data: DmmItemListResponse) {
  const validItems = filterValidJacketItems(data.result.items);
  const sanitized = sanitizeDmmItemResponse({
    ...data,
    result: {
      ...data.result,
      items: validItems.slice(0, 1),
      result_count: validItems.length > 0 ? 1 : 0,
    },
  });

  return sanitized;
}

export async function GET() {
  if (!isDmmConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message: "DMM API credentials are not configured",
        error: "DMM_API_ID must be set in .env.local (DMM_AFFILIATE_ID is optional; defaults to zukanjp-990 for API)",
      },
      { status: 500 },
    );
  }

  try {
    const data = await fetchItem();
    return NextResponse.json(sanitizeTestResponse(data));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch DMM item";

    return NextResponse.json(
      {
        success: false,
        message,
        error: message,
      },
      { status: 500 },
    );
  }
}
