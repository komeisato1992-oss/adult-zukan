import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  CatalogPromoteError,
  promoteCatalogToProduction,
} from "@/lib/admin/catalog-promote";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await promoteCatalogToProduction({
      actor: "admin",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof CatalogPromoteError
        ? error.message
        : error instanceof Error
          ? error.message
          : "本番反映に失敗しました。";
    const status =
      error instanceof CatalogPromoteError ? error.status : 500;
    return NextResponse.json(
      { success: false, error: message, message },
      { status },
    );
  }
}
