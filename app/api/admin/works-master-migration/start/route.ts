import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { startWorksMasterMigration } from "@/lib/admin/works-master-migration-runner";
import { WORKS_MASTER_MIGRATION_DEFAULT_BATCH_SIZE } from "@/lib/admin/works-master-migration-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      batchSize?: number;
      forceRestart?: boolean;
    };
    const result = await startWorksMasterMigration({
      batchSize:
        typeof body.batchSize === "number" && body.batchSize > 0
          ? Math.floor(body.batchSize)
          : WORKS_MASTER_MIGRATION_DEFAULT_BATCH_SIZE,
      forceRestart: Boolean(body.forceRestart),
    });
    return NextResponse.json({
      success: true,
      job: result.job,
      preview: result.preview,
      resumed: false,
      deployRequired: false,
      gitWrite: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[works-master-migration/start] failed", error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
