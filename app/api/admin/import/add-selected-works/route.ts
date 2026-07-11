import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  addSelectedWorksToCatalog,
  AddSelectedWorksError,
  parseAddSelectedWorksRequest,
  toAddSelectedWorksErrorMessage,
} from "@/lib/admin/add-selected-works";
import { AddSelectedWorksFailure } from "@/lib/admin/add-selected-works-types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const startedAt = Date.now();

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody = "";
  let payloadByteLength = 0;

  try {
    rawBody = await request.text();
    payloadByteLength = Buffer.byteLength(rawBody, "utf8");

    console.log("[add-selected-api] request received", {
      payloadByteLength,
      payloadMb: (payloadByteLength / 1024 / 1024).toFixed(2),
    });

    const body = rawBody ? JSON.parse(rawBody) : null;
    const works = parseAddSelectedWorksRequest(body);
    const result = await addSelectedWorksToCatalog(works);

    return NextResponse.json({
      success: true,
      ...result,
      debug: {
        payloadByteLength,
        elapsedMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    console.error("[add-selected-api] route failed", {
      phase:
        error instanceof AddSelectedWorksFailure ? error.phase : undefined,
      error,
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      payloadByteLength,
      elapsedMs: Date.now() - startedAt,
    });

    if (error instanceof AddSelectedWorksError) {
      return NextResponse.json(
        {
          success: false,
          phase: "validate-request",
          message: error.message,
          error: error.message,
        },
        { status: error.status },
      );
    }

    const { message, status, phase, details } =
      toAddSelectedWorksErrorMessage(error);

    return NextResponse.json(
      {
        success: false,
        phase: details?.githubPhase ?? phase ?? "github-commit",
        message,
        error: message,
        githubStatus: details?.status,
        githubResponse: details?.githubResponse ?? details?.githubMessage,
        details: {
          ...details,
          payloadByteLength,
          elapsedMs: Date.now() - startedAt,
        },
      },
      { status },
    );
  }
}
