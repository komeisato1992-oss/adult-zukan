import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { DmmReportParseError } from "@/lib/admin/dmm-report-parse";
import { importDmmRewardCsv } from "@/lib/admin/dmm-report-store";
import { getOpsDashboardData } from "@/lib/admin/ops-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const typeRaw = String(form.get("type") ?? "").toLowerCase();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "ファイルが指定されていません。" },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".csv") && typeRaw !== "category" && typeRaw !== "direct") {
      // still allow if type is set
    }

    const buffer = await file.arrayBuffer();
    const result = await importDmmRewardCsv({
      buffer,
      type: typeRaw || null,
      fileName: file.name,
    });

    const ops = await getOpsDashboardData();

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      total: result.total,
      type: result.type,
      dateRange: result.dateRange,
      updatedAt: result.updatedAt,
      data: ops,
    });
  } catch (error) {
    const status = error instanceof DmmReportParseError ? error.status : 500;
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "DMM成果データの取込に失敗しました。",
      },
      { status },
    );
  }
}
