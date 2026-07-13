import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  CatalogPromoteError,
  buildCatalogPromoteDiff,
} from "@/lib/admin/catalog-promote";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const diff = await buildCatalogPromoteDiff();
    return NextResponse.json({ success: true, diff });
  } catch (error) {
    const message =
      error instanceof CatalogPromoteError
        ? error.message
        : error instanceof Error
          ? error.message
          : "差分の取得に失敗しました。";
    const status =
      error instanceof CatalogPromoteError ? error.status : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
