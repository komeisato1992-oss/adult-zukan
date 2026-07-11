import { NextResponse } from "next/server";
import {
  AddWorkValidationError,
  previewBulkAddWorks,
  toAddWorkErrorMessage,
} from "@/lib/admin/add-work";
import { resolveBulkAddSelection } from "@/lib/admin/resolve-bulk-selection";
import { isAdminAuthenticated } from "@/lib/admin/auth";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as unknown;
    const { works } = await resolveBulkAddSelection(body);
    const preview = await previewBulkAddWorks(works);

    return NextResponse.json(preview);
  } catch (error) {
    const { message, status } = toAddWorkErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
