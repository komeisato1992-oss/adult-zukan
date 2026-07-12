import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getDmmAdminStatus } from "@/lib/admin/dmm-affiliate-service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getDmmAdminStatus();
  return NextResponse.json({ success: true, data });
}
