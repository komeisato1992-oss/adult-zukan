import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  CatalogPromoteError,
  discardCatalogWorkingChanges,
} from "@/lib/admin/catalog-promote";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      confirmText?: string;
    };
    const result = await discardCatalogWorkingChanges({
      actor: "admin",
      confirmText: body.confirmText ?? "",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof CatalogPromoteError
        ? error.message
        : error instanceof Error
          ? error.message
          : "作業内容の破棄に失敗しました。";
    const status =
      error instanceof CatalogPromoteError ? error.status : 500;
    return NextResponse.json(
      { success: false, error: message, message },
      { status },
    );
  }
}
