import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  CatalogPromoteError,
  promoteCatalogToProduction,
  toPromoteErrorResult,
} from "@/lib/admin/catalog-promote";
import type { CatalogPromoteStatus } from "@/lib/admin/catalog-promote-types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        status: "FAILED",
        workingBranch: null,
        productionBranch: "main",
        workingSha: null,
        previousMainSha: null,
        mergedMainSha: null,
        deploymentTriggered: false,
        message: "認証が必要です。",
        errorCode: "UNAUTHORIZED",
        httpStatus: 401,
        retryable: false,
        failedStage: "IDLE",
        lastPromoteAt: null,
        productionUrl: null,
        deployState: null,
        deployMode: null,
        statusPayload: null,
      },
      { status: 401 },
    );
  }

  const accept = request.headers.get("accept") ?? "";
  const wantsStream =
    accept.includes("application/x-ndjson") ||
    accept.includes("text/event-stream");

  if (!wantsStream) {
    try {
      const result = await promoteCatalogToProduction({ actor: "admin" });
      return NextResponse.json(result, { status: 200 });
    } catch (error) {
      const payload = toPromoteErrorResult(error);
      const status =
        error instanceof CatalogPromoteError ? error.status : payload.httpStatus;
      return NextResponse.json(payload, { status });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
      };

      try {
        const result = await promoteCatalogToProduction({
          actor: "admin",
          onProgress: async (status: CatalogPromoteStatus) => {
            send({ type: "progress", status });
          },
        });
        send({ type: "result", ...result });
      } catch (error) {
        const payload = toPromoteErrorResult(error);
        send({ type: "result", ...payload });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
