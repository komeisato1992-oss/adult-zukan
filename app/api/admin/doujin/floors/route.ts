import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { consumeAdminRateLimit } from "@/lib/admin/rate-limit";
import {
  filterDoujinRelatedFloors,
  fetchDmmFloorList,
} from "@/lib/dmm/floor-list";
import {
  DOUJIN_RECOMMENDED_FLOOR,
  readDoujinFloorEnv,
} from "@/lib/doujin/floor-config";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = consumeAdminRateLimit("admin-doujin-floors");
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSec: rate.retryAfterSec },
      { status: 429 },
    );
  }

  try {
    const floors = await fetchDmmFloorList();
    const doujinRelated = filterDoujinRelatedFloors(floors);
    return NextResponse.json({
      floors,
      doujinRelated,
      recommended: DOUJIN_RECOMMENDED_FLOOR,
      env: readDoujinFloorEnv(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "FloorList failed",
      },
      { status: 500 },
    );
  }
}
