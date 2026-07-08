import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "単体追加は無効です。作品を選択して「選択した作品を一括追加」をご利用ください。",
    },
    { status: 400 },
  );
}
