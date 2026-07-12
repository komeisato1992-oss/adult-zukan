import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  applyActressImageManualSelection,
  getActressImageReview,
  getClothedPriorityReselectStatus,
  processClothedPriorityReselectChunk,
  startClothedPriorityReselect,
} from "@/lib/admin/actress-image-admin";
import { ensureActressImageOverridesLoaded } from "@/lib/dmm/actress-image-overrides";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json(
      { error: "name クエリが必要です。" },
      { status: 400 },
    );
  }

  try {
    await ensureActressImageOverridesLoaded();
    const review = await getActressImageReview(name);
    return NextResponse.json({ success: true, review });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      actressName?: string;
      mode?: "pick" | "default" | "clear";
      imageUrl?: string;
      workId?: string | null;
      isSoloWork?: boolean;
      faceDetected?: boolean;
      score?: number;
      action?: "reselect-start" | "reselect-tick" | "reselect-status";
    };

    if (body.action === "reselect-status") {
      const job = await getClothedPriorityReselectStatus();
      return NextResponse.json({ success: true, job });
    }

    if (body.action === "reselect-start") {
      const job = await startClothedPriorityReselect();
      return NextResponse.json({ success: true, job });
    }

    if (body.action === "reselect-tick") {
      const job = await processClothedPriorityReselectChunk(8);
      return NextResponse.json({ success: true, job });
    }

    if (!body.actressName?.trim() || !body.mode) {
      return NextResponse.json(
        { error: "actressName と mode が必要です。" },
        { status: 400 },
      );
    }

    const review = await applyActressImageManualSelection({
      actressName: body.actressName.trim(),
      mode: body.mode,
      imageUrl: body.imageUrl,
      workId: body.workId,
      isSoloWork: body.isSoloWork,
      faceDetected: body.faceDetected,
      score: body.score,
    });

    return NextResponse.json({ success: true, review });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "更新に失敗しました。",
      },
      { status: 500 },
    );
  }
}
