import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  regenerateSnsPost,
  SnsRegenerateError,
} from "@/lib/admin/sns-regenerate";
import type { SnsPostMeta, SnsPostType } from "@/lib/admin/sns-types";

type RegenerateRequestBody = {
  type?: SnsPostType;
  meta?: SnsPostMeta;
};

const VALID_TYPES: SnsPostType[] = [
  "recommended-work",
  "compare",
  "actress",
  "genre",
  "ranking",
];

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as RegenerateRequestBody;

    if (!body.type || !VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: "投稿タイプが不正です。" },
        { status: 400 },
      );
    }

    const result = await regenerateSnsPost(body.type, body.meta);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SnsRegenerateError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "別案の更新に失敗しました。" },
      { status: 500 },
    );
  }
}
