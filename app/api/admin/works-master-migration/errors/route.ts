import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { buildWorksMasterMigrationErrorsCsv } from "@/lib/admin/works-master-migration-job";
import { readWorksMasterMigrationJob } from "@/lib/admin/works-master-migration-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = readWorksMasterMigrationJob();
  const csv = buildWorksMasterMigrationErrorsCsv(job);
  const filename = `works-master-migration-errors-${job.jobId}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
