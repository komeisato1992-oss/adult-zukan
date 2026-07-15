import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  patchWorksCmsPublish,
  updateWorkMasterFields,
} from "@/lib/admin/works-cms-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      type?: "publish" | "edit";
      cids?: string[];
      action?: Parameters<typeof patchWorksCmsPublish>[0]["action"];
      reason?: string;
      cid?: string;
      patch?: Parameters<typeof updateWorkMasterFields>[0]["patch"];
      confirmHardDelete?: boolean;
      confirmHardDeleteAgain?: boolean;
    };

    if (body.type === "edit") {
      if (!body.cid || !body.patch) {
        return NextResponse.json({ error: "cid と patch が必要です" }, { status: 400 });
      }
      const result = await updateWorkMasterFields({
        cid: body.cid,
        patch: body.patch,
      });
      return NextResponse.json({
        success: true,
        ...result,
        deployRequired: false,
        gitWrite: false,
      });
    }

    if (!body.action || !Array.isArray(body.cids)) {
      return NextResponse.json({ error: "action と cids が必要です" }, { status: 400 });
    }

    if (body.action === "hard_delete") {
      if (!body.confirmHardDelete || !body.confirmHardDeleteAgain) {
        return NextResponse.json(
          { error: "完全削除は2段階確認が必要です" },
          { status: 400 },
        );
      }
    }

    const result = await patchWorksCmsPublish({
      cids: body.cids,
      action: body.action,
      reason: body.reason,
    });

    return NextResponse.json({
      success: true,
      ...result,
      deployRequired: false,
      gitWrite: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
