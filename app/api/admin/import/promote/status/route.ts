import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  CatalogPromoteError,
  getCatalogPromoteStatus,
} from "@/lib/admin/catalog-promote";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getCatalogPromoteStatus();
    return NextResponse.json({ success: true, status });
  } catch (error) {
    const message =
      error instanceof CatalogPromoteError
        ? error.message
        : error instanceof Error
          ? error.message
          : "状態の取得に失敗しました。";
    const status =
      error instanceof CatalogPromoteError ? error.status : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
