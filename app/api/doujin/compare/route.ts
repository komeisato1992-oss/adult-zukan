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
    .slice(0, 4);

  const worksById = new Map(
    getDoujinPublicWorks().map((work) => [work.id, work]),
  );
  const works = ids
    .map((id) => worksById.get(id))
    .filter((work): work is NonNullable<typeof work> => Boolean(work));
  return NextResponse.json({ items: works });
}
