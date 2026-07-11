import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  addSelectedWorksToCatalog,
  AddSelectedWorksError,
  parseAddSelectedWorksRequest,
  toAddSelectedWorksErrorMessage,
} from "@/lib/admin/add-selected-works";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const works = parseAddSelectedWorksRequest(body);
    const result = await addSelectedWorksToCatalog(works);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[add-selected-works] failed", error);

    if (error instanceof AddSelectedWorksError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const { message, status } = toAddSelectedWorksErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
