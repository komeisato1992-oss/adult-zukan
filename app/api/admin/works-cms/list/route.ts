import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  listWorksCmsItems,
  type WorksCmsListFilter,
} from "@/lib/admin/works-cms-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filter: WorksCmsListFilter = {
    q: url.searchParams.get("q") ?? undefined,
    cid: url.searchParams.get("cid") ?? undefined,
    actress: url.searchParams.get("actress") ?? undefined,
    maker: url.searchParams.get("maker") ?? undefined,
    label: url.searchParams.get("label") ?? undefined,
    series: url.searchParams.get("series") ?? undefined,
    genre: url.searchParams.get("genre") ?? undefined,
    published: (url.searchParams.get("published") as WorksCmsListFilter["published"]) || "all",
    noImage: url.searchParams.get("noImage") === "1",
    unavailable: url.searchParams.get("unavailable") === "1",
    manualHidden: url.searchParams.get("manualHidden") === "1",
    fanzaTv: (url.searchParams.get("fanzaTv") as WorksCmsListFilter["fanzaTv"]) || "all",
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 20),
  };

  try {
    const result = await listWorksCmsItems(filter);
    return NextResponse.json({ success: true, ...result, deployRequired: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
