/**
 * パッケージ画像ステータス判定。
 *
 * 追加・掲載情報更新時のみ呼び出す（通常閲覧・検索・公開管理では使わない）。
 *
 * ① URL 文字列に now_printing / noimage があれば GET せず now_printing
 * ② それ以外のみ画像を最大1回 GET し、最終URL / 画像内容で判定
 */
import "server-only";

import { createHash } from "node:crypto";
import {
  ADULT_IMAGE_STATUS,
  type AdultImageStatus,
} from "@/lib/works/image-status-shared";
import { urlIndicatesNowPrinting } from "@/lib/works/package-image";

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
  /** true のとき画像 GET を実行した */
  fetched?: boolean;
};

/**
 * 実測済み NOW PRINTING 本体の SHA-1（追加・更新時の画像内容比較用）。
 * 参照URLの追加取得は行わない（通信量を抑える）。
 */
const KNOWN_NOW_PRINTING_SHA1 = new Set<string>([
  // pics.dmm.co.jp/digital/video/now_printing.jpg → imgsrc.../now_printing.jpg
  "97d573a5b0cc474eb1e95265960b4a066f3aa4b7",
]);

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 8 * 1024 * 1024;

function sha1Hex(buf: Buffer): string {
  return createHash("sha1").update(buf).digest("hex");
}

/**
 * 追加・更新時専用。
 * URL だけで判定できる場合は GET しない。通常のページ表示からは呼ばないこと。
 */
export async function detectAdultImageStatus(
  url?: string | null,
): Promise<AdultImageStatusResult> {
  const checkedAt = new Date().toISOString();
  const trimmed = url?.trim() || null;

  if (!trimmed) {
    return {
      status: ADULT_IMAGE_STATUS.fetchFailed,
      checkedAt,
      finalUrl: null,
      fetched: false,
    };
  }

  // ① 最優先: URL 文字列のみ（now_printing / noimage）。GET しない
  if (urlIndicatesNowPrinting(trimmed)) {
    return {
      status: ADULT_IMAGE_STATUS.nowPrinting,
      checkedAt,
      finalUrl: trimmed,
      fetched: false,
    };
  }

  // ② URL だけでは判定できない作品のみ GET
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
        fetched: true,
      };
    }

    // リダイレクト後の最終URL
    if (urlIndicatesNowPrinting(finalUrl)) {
      return {
        status: ADULT_IMAGE_STATUS.nowPrinting,
        checkedAt,
        finalUrl,
        fetched: true,
      };
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.startsWith("image/")) {
      return {
        status: ADULT_IMAGE_STATUS.fetchFailed,
        checkedAt,
        finalUrl,
        fetched: true,
      };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) {
      return {
        status: ADULT_IMAGE_STATUS.fetchFailed,
        checkedAt,
        finalUrl,
        bytes: buf.length,
        fetched: true,
      };
    }

    // 取得した画像（既知 NOW PRINTING ハッシュ）
    const hash = sha1Hex(buf);
    if (KNOWN_NOW_PRINTING_SHA1.has(hash)) {
      return {
        status: ADULT_IMAGE_STATUS.nowPrinting,
        checkedAt,
        finalUrl,
        bytes: buf.length,
        fetched: true,
      };
    }

    return {
      status: ADULT_IMAGE_STATUS.ok,
      checkedAt,
      finalUrl,
      bytes: buf.length,
      fetched: true,
    };
  } catch {
    return {
      status: ADULT_IMAGE_STATUS.fetchFailed,
      checkedAt,
      finalUrl: trimmed,
      fetched: true,
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
