import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { DmmReportParseError } from "@/lib/admin/dmm-report-parse";
import { importDmmReportsText } from "@/lib/admin/dmm-report-store";
import { getDmmAdminStatus } from "@/lib/admin/dmm-affiliate-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const formatRaw = String(form.get("format") ?? "").toLowerCase();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "ファイルが指定されていません。" },
        { status: 400 },
      );
    }

    const format: "json" | "csv" =
      formatRaw === "csv" || file.name.toLowerCase().endsWith(".csv")
        ? "csv"
        : "json";

    const text = await file.text();
    const result = await importDmmReportsText({
      text,
      format,
      fileName: file.name,
      source: format,
    });

    const status = await getDmmAdminStatus();

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      total: result.total,
      dateRange: result.dateRange,
      updatedAt: result.updatedAt,
      data: status,
    });
  } catch (error) {
    const status =
      error instanceof DmmReportParseError ? error.status : 500;
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
