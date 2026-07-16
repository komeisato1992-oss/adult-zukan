import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getWorksCmsOverview,
  invalidateWorksCmsOverviewCache,
} from "@/lib/admin/works-cms-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const force = request.nextUrl.searchParams.get("refresh") === "1";
    if (force) invalidateWorksCmsOverviewCache();
    const overview = await getWorksCmsOverview({ force });
    return NextResponse.json({ success: true, overview });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
