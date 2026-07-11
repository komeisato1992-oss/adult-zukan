import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  fetchImportCandidates,
  FetchImportCandidatesError,
  parseFetchCandidatesRequest,
} from "@/lib/admin/fetch-import-candidates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const params = parseFetchCandidatesRequest(body);
    const result = await fetchImportCandidates(params);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[fetch-candidates] failed", error);

    if (error instanceof FetchImportCandidatesError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "候補の取得に失敗しました。カタログは変更されていません。",
      },
      { status: 500 },
    );
  }
}
