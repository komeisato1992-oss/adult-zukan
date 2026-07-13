import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { consumeAdminRateLimit } from "@/lib/admin/rate-limit";
import { diagnoseDoujinItem } from "@/lib/doujin/fetch-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = consumeAdminRateLimit("admin-doujin-diagnostic", 20);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSec: rate.retryAfterSec },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as {
      site?: string;
      service?: string;
      floor?: string;
      keyword?: string;
      sort?: string;
      offset?: number;
    };

    const result = await diagnoseDoujinItem(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Diagnostic failed",
      },
      { status: 400 },
    );
  }
}
