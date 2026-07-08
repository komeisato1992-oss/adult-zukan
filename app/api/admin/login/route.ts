import { NextResponse } from "next/server";
import {
  getAdminSessionCookieOptions,
  verifyAdminPassword,
} from "@/lib/admin/auth";

export async function POST(request: Request) {
  let password = "";

  try {
    const body = (await request.json()) as { password?: string };
    password = body.password?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "パスワードを入力してください" }, { status: 400 });
  }

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  const cookieOptions = getAdminSessionCookieOptions();
  if (!cookieOptions.value) {
    return NextResponse.json(
      { error: "管理者パスワードが設定されていません" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(cookieOptions);
  return response;
}
