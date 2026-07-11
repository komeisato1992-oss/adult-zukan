import { NextResponse } from "next/server";
import {
  previewBulkAddWorks,
  toAddWorkErrorMessage,
} from "@/lib/admin/add-work";
import { describeBulkAddRequestBody, resolveBulkAddSelection } from "@/lib/admin/resolve-bulk-selection";
import { isAdminAuthenticated } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as unknown;
    const resolved = await resolveBulkAddSelection(body);
    const preview = await previewBulkAddWorks(resolved.works);

    return NextResponse.json({
      ...preview,
      debug: resolved.debug,
    });
  } catch (error) {
    const { message, status } = toAddWorkErrorMessage(error);
    const body = await request
      .clone()
      .json()
      .catch(() => null);
    return NextResponse.json(
      {
        error: message,
        debug: describeBulkAddRequestBody(body),
      },
      { status },
    );
  }
}
