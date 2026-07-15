import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { resumeWorksMasterMigration } from "@/lib/admin/works-master-migration-runner";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await resumeWorksMasterMigration();
    return NextResponse.json({
      success: true,
      job: result.job,
      resumed: result.resumed,
      deployRequired: false,
      gitWrite: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[works-master-migration/resume] failed", error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
