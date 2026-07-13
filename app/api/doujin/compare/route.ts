import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { canAccessDoujinSite } from "@/lib/doujin/access";
import { getDoujinPublicWorks } from "@/lib/doujin/catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const isAdmin = await isAdminAuthenticated();
  if (!canAccessDoujinSite({ isAdmin })) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100);

  const works = getDoujinPublicWorks().filter((work) => ids.includes(work.id));
  return NextResponse.json({ items: works });
}
