import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  CatalogBranchError,
  syncWorkingBranchWithProduction,
} from "@/lib/admin/catalog-branch";
import { getCatalogPromoteStatus } from "@/lib/admin/catalog-promote";

export const dynamic = "force-dynamic";

/** 作業ブランチを本番の最新内容で更新（fetch + rebase + push 相当） */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncWorkingBranchWithProduction();
    const status = await getCatalogPromoteStatus();
    return NextResponse.json({
      success: !result.conflict,
      ...result,
      status,
    });
  } catch (error) {
    console.error("[promote/sync-working] failed", error);
    const message =
      error instanceof Error ? error.message : "作業ブランチの最新化に失敗しました。";
    const status =
      error instanceof CatalogBranchError ? error.status : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
