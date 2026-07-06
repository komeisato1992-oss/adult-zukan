import { NextResponse } from "next/server";
import {
  fetchDmmItemByContentId,
  isDmmConfigured,
} from "@/lib/dmm/client";
import { sanitizeDmmItemResponse } from "@/lib/dmm/sanitize";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ contentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { contentId } = await context.params;

  if (!isDmmConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message: "DMM API credentials are not configured",
        error: "DMM_API_ID and DMM_AFFILIATE_ID must be set in .env.local",
      },
      { status: 500 },
    );
  }

  try {
    const data = await fetchDmmItemByContentId(contentId);
    const item = data.result.items[0];

    if (!item) {
      return NextResponse.json(
        {
          success: false,
          message: "作品が見つかりませんでした",
          error: "作品が見つかりませんでした",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(sanitizeDmmItemResponse(data));
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
