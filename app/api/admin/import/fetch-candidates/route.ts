import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  fetchImportCandidates,
  FetchImportCandidatesError,
  parseFetchCandidatesRequest,
} from "@/lib/admin/fetch-import-candidates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type FailureCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "FANZA_API_NOT_CONFIGURED"
  | "FANZA_API_FAILED"
  | "INTERNAL_ERROR";

function jsonFailure(input: {
  errorCode: FailureCode;
  message: string;
  status: number;
}) {
  return NextResponse.json(
    {
      ok: false,
      success: false,
      errorCode: input.errorCode,
      message: input.message,
      error: input.message,
      status: input.status,
      items: [],
      candidates: [],
      totalFetched: 0,
      existingCount: 0,
      duplicateCount: 0,
      newCandidateCount: 0,
      noImageCount: 0,
    },
    { status: input.status },
  );
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return jsonFailure({
      errorCode: "UNAUTHORIZED",
      message: "認証が必要です",
      status: 401,
    });
  }

  try {
    const body = await request.json().catch(() => null);
    const params = parseFetchCandidatesRequest(body);
    const result = await fetchImportCandidates(params);
    const summary = result.summary;

    return NextResponse.json({
      ok: true,
      success: true,
      candidates: result.candidates,
      items: result.candidates,
      summary,
      totalFetched: summary.apiFetchedCount,
      existingCount: summary.publishedExcludedCount,
      duplicateCount:
        summary.publishedExcludedCount + summary.duplicateExcludedCount,
      newCandidateCount: summary.candidateCount,
      noImageCount: summary.imageMissingExcludedCount,
      message: summary.message,
    });
  } catch (error) {
    console.error("[fetch-candidates] failed", error);

    if (error instanceof FetchImportCandidatesError) {
      const errorCode: FailureCode =
        error.status === 503
          ? "FANZA_API_NOT_CONFIGURED"
          : error.status >= 500
            ? "FANZA_API_FAILED"
            : "INVALID_REQUEST";
      return jsonFailure({
        errorCode,
        message: error.message,
        status: error.status,
      });
    }

    const message =
      error instanceof Error && error.message
        ? error.message
        : "FANZA APIから候補を取得できませんでした";

    return jsonFailure({
      errorCode: "FANZA_API_FAILED",
      message,
      status: 500,
    });
  }
}
