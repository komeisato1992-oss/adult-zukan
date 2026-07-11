import "server-only";

import { fetchDmmItemList } from "@/lib/dmm/client";
import type { DmmItemListResponse } from "@/lib/dmm/types";

export class FanzaApiTransportError extends Error {
  status?: number;
  retryable: boolean;

  constructor(message: string, options?: { status?: number; retryable?: boolean }) {
    super(message);
    this.name = "FanzaApiTransportError";
    this.status = options?.status;
    this.retryable = options?.retryable ?? true;
  }
}

export class FanzaProductNotFoundError extends Error {
  contentId: string;

  constructor(contentId: string) {
    super(`FANZA product not found: ${contentId}`);
    this.name = "FanzaProductNotFoundError";
    this.contentId = contentId;
  }
}

function getRetryConfig() {
  return {
    maxAttempts: Number(process.env.FANZA_SYNC_MAX_RETRIES ?? 3),
    baseDelayMs: Number(process.env.FANZA_SYNC_RETRY_BASE_MS ?? 500),
    timeoutMs: Number(process.env.FANZA_SYNC_TIMEOUT_MS ?? 15000),
  };
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  contentId: string,
  timeoutMs: number,
): Promise<DmmItemListResponse> {
  try {
    return await fetchDmmItemList({
      cid: contentId,
      hits: 1,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && /DMM API request failed: (\d+)/.test(error.message)) {
      const match = error.message.match(/DMM API request failed: (\d+)/);
      const status = match ? Number(match[1]) : undefined;
      throw new FanzaApiTransportError(error.message, {
        status,
        retryable: status ? isRetryableStatus(status) : true,
      });
    }

    throw new FanzaApiTransportError(
      error instanceof Error ? error.message : "FANZA API request failed",
      { retryable: true },
    );
  }
}

/** content_id で FANZA 商品を取得（retry / exponential backoff 付き） */
export async function fetchFanzaProductByContentId(
  contentId: string,
): Promise<DmmItemListResponse> {
  const { maxAttempts, baseDelayMs, timeoutMs } = getRetryConfig();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(contentId, timeoutMs);

      if (String(response.result.status) !== "200") {
        throw new FanzaApiTransportError(
          `FANZA API returned status ${response.result.status}`,
          { retryable: true },
        );
      }

      return response;
    } catch (error) {
      lastError = error;

      if (error instanceof FanzaProductNotFoundError) {
        throw error;
      }

      if (attempt >= maxAttempts) break;

      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn("[fanza-sync-client] retry", {
        contentId,
        attempt,
        delay,
        message: error instanceof Error ? error.message : String(error),
      });
      await sleep(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new FanzaApiTransportError("FANZA API request failed after retries");
}

export async function fetchFanzaProductItem(contentId: string) {
  const response = await fetchFanzaProductByContentId(contentId);
  const item = response.result.items?.[0];

  if (!item) {
    throw new FanzaProductNotFoundError(contentId);
  }

  return item;
}
