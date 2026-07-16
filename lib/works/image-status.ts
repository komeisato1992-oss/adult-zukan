/**
 * パッケージ画像ステータス判定。
 *
 * 追加・掲載情報更新時のみ呼び出す（通常閲覧では使わない）。
 * 画像を最大1回 GET し、正常 / NOW PRINTING / 取得失敗 を返す。
 */
import "server-only";

import { createHash } from "node:crypto";
import {
  ADULT_IMAGE_STATUS,
  type AdultImageStatus,
} from "@/lib/works/image-status-shared";
import { isMissingAdultImage } from "@/lib/works/package-image";

export {
  ADULT_IMAGE_STATUS,
  hasDisplayableAdultImage,
  isAdultImageStatusMissing,
  isAdultImageStatusOk,
  type AdultImageStatus,
} from "@/lib/works/image-status-shared";

export type AdultImageStatusResult = {
  status: AdultImageStatus;
  checkedAt: string;
  finalUrl?: string | null;
  bytes?: number;
};

/** 実測済み NOW PRINTING 本体の SHA-1（追加・更新時の比較用） */
const KNOWN_NOW_PRINTING_SHA1 = new Set<string>([
  // pics.dmm.co.jp/digital/video/now_printing.jpg → imgsrc.../now_printing.jpg
  "97d573a5b0cc474eb1e95265960b4a066f3aa4b7",
]);

const REFERENCE_NOW_PRINTING_URLS = [
  "https://pics.dmm.co.jp/digital/video/now_printing.jpg",
  "https://pics.dmm.co.jp/digital/video/now_printing/now_printingpl.jpg",
  "https://pics.dmm.co.jp/digital/video/now_printing/now_printingps.jpg",
  "https://pics.dmm.co.jp/digital/now_printing.jpg",
  "https://pics.dmm.com/mono/noimage/now_printing.jpg",
] as const;

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 8 * 1024 * 1024;

let referenceHashesReady: Promise<void> | null = null;

function sha1Hex(buf: Buffer): string {
  return createHash("sha1").update(buf).digest("hex");
}

function looksLikeNowPrintingUrl(url: string | null | undefined): boolean {
  return isMissingAdultImage(url) && Boolean(url?.trim());
}

async function loadReferenceHashes(): Promise<void> {
  await Promise.all(
    REFERENCE_NOW_PRINTING_URLS.map(async (url) => {
      try {
        const res = await fetch(url, {
          redirect: "follow",
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 0 && buf.length < 200_000) {
          KNOWN_NOW_PRINTING_SHA1.add(sha1Hex(buf));
        }
      } catch {
        // 参照取得失敗は既知ハッシュだけで継続
      }
    }),
  );
}

function ensureReferenceHashes(): Promise<void> {
  if (!referenceHashesReady) {
    referenceHashesReady = loadReferenceHashes().catch(() => undefined);
  }
  return referenceHashesReady;
}

/**
 * 追加・更新時専用。URL へ GET して image_status を決める。
 * 通常のページ表示からは呼ばないこと。
 */
export async function detectAdultImageStatus(
  url?: string | null,
): Promise<AdultImageStatusResult> {
  const checkedAt = new Date().toISOString();
  const trimmed = url?.trim() || null;

  if (!trimmed || isMissingAdultImage(trimmed)) {
    if (!trimmed) {
      return { status: ADULT_IMAGE_STATUS.fetchFailed, checkedAt, finalUrl: null };
    }
    return {
      status: ADULT_IMAGE_STATUS.nowPrinting,
      checkedAt,
      finalUrl: trimmed,
    };
  }

  await ensureReferenceHashes();

  try {
    const res = await fetch(trimmed, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const finalUrl = res.url || trimmed;

    if (!res.ok) {
      return {
        status: ADULT_IMAGE_STATUS.fetchFailed,
        checkedAt,
        finalUrl,
      };
    }

    if (looksLikeNowPrintingUrl(finalUrl)) {
      return {
        status: ADULT_IMAGE_STATUS.nowPrinting,
        checkedAt,
        finalUrl,
      };
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.startsWith("image/")) {
      return {
        status: ADULT_IMAGE_STATUS.fetchFailed,
        checkedAt,
        finalUrl,
      };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) {
      return {
        status: ADULT_IMAGE_STATUS.fetchFailed,
        checkedAt,
        finalUrl,
        bytes: buf.length,
      };
    }

    const hash = sha1Hex(buf);
    if (KNOWN_NOW_PRINTING_SHA1.has(hash)) {
      return {
        status: ADULT_IMAGE_STATUS.nowPrinting,
        checkedAt,
        finalUrl,
        bytes: buf.length,
      };
    }

    return {
      status: ADULT_IMAGE_STATUS.ok,
      checkedAt,
      finalUrl,
      bytes: buf.length,
    };
  } catch {
    return {
      status: ADULT_IMAGE_STATUS.fetchFailed,
      checkedAt,
      finalUrl: trimmed,
    };
  }
}

export async function detectAdultImageStatusMany(
  urls: Array<string | null | undefined>,
  concurrency = 4,
): Promise<AdultImageStatusResult[]> {
  const results: AdultImageStatusResult[] = new Array(urls.length);
  let next = 0;

  async function worker() {
    while (next < urls.length) {
      const i = next;
      next += 1;
      results[i] = await detectAdultImageStatus(urls[i]);
    }
  }

  const n = Math.max(1, Math.min(concurrency, urls.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
