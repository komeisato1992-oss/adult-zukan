import { NextResponse } from "next/server";
import {
  previewBulkAddWorks,
  toAddWorkErrorMessage,
} from "@/lib/admin/add-work";
import { logBulkAddServerError } from "@/lib/admin/bulk-add-safe";
import { describeBulkAddRequestBody, resolveBulkAddSelection } from "@/lib/admin/resolve-bulk-selection";
import { isAdminAuthenticated } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  console.log("[bulk-add] preview route start");

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestBody: unknown = null;

  try {
    console.log("[bulk-add] preview parsing request body");
    requestBody = await request.json();
    console.log("[bulk-add] preview request body parsed");

    const resolved = await resolveBulkAddSelection(requestBody);
    console.log("[bulk-add] preview selection resolved", resolved.debug);

    const preview = await previewBulkAddWorks(resolved.works);
    console.log("[bulk-add] preview complete", {
      selectedCount: preview.selectedCount,
      toAddCount: preview.toAddCount,
      duplicateCount: preview.duplicateCount,
      invalidCount: preview.invalidCount,
    });

    return NextResponse.json({
      ...preview,
      debug: resolved.debug,
    });
  } catch (error) {
    logBulkAddServerError("bulk-add-preview route", error, {
      hasRequestBody: Boolean(requestBody),
    });
    const { message, status } = toAddWorkErrorMessage(error);
    return NextResponse.json(
      {
        error: message,
        debug: describeBulkAddRequestBody(requestBody),
      },
      { status },
    );
  }
}
