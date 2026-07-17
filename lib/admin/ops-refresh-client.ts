/**
 * 運営ダッシュボード手動更新用（ブラウザ）。
 * サーバ専用 import は入れないこと。
 */

import type { OpsDashboardPayload, OpsRefreshSource } from "@/lib/admin/ops-types";

export type OpsRefreshJobKey = "seo" | "ga4" | "dmm" | "score";

export type OpsRefreshJobStatus =
  | "idle"
  | "pending"
  | "success"
  | "error"
  | "timeout";

export const OPS_REFRESH_TIMEOUT_MS: Record<OpsRefreshJobKey, number> = {
  seo: 240_000,
  ga4: 30_000,
  dmm: 20_000,
  score: 30_000,
};

export const OPS_REFRESH_JOB_LABELS: Record<OpsRefreshJobKey, string> = {
  seo: "Search Console",
  ga4: "GA4",
  dmm: "DMM",
  score: "SEO",
};

export const OPS_REFRESH_JOB_KEYS: OpsRefreshJobKey[] = [
  "seo",
  "ga4",
  "dmm",
  "score",
];

export class OpsRefreshTimeoutError extends Error {
  readonly timedOut = true as const;

  constructor(label: string) {
    super(`${label}がタイムアウトしました。`);
    this.name = "OpsRefreshTimeoutError";
  }
}

const OPS_FETCH_HEADERS: HeadersInit = {
  "Cache-Control": "no-store",
};

function looksLikeHtml(text: string): boolean {
  const head = text.trimStart().slice(0, 64).toLowerCase();
  return (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<head") ||
    head.startsWith("<body")
  );
}

/** API / ネットワークエラーを運営向けの日本語メッセージへ変換 */
export function humanizeOpsRefreshError(error: unknown): string {
  if (error instanceof OpsRefreshTimeoutError) {
    return "タイムアウト";
  }

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "更新に失敗しました。";
  const message = raw.replace(/\s+/g, " ").trim();
  const lower = message.toLowerCase();

  if (
    lower.includes("unexpected token") ||
    lower.includes("is not valid json") ||
    lower.includes("<!doctype") ||
    lower.includes("<html")
  ) {
    return "APIがHTMLを返しました（認証切れやサーバーエラーの可能性があります）";
  }
  if (
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("認証") ||
    lower.includes("forbidden") ||
    lower.includes("403")
  ) {
    return "認証に失敗しました。再ログインしてください";
  }
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("aborted") ||
    lower.includes("タイムアウト")
  ) {
    return "タイムアウト";
  }
  if (
    lower.includes("未設定") ||
    lower.includes("not configured") ||
    lower.includes("missing") ||
    lower.includes("environment") ||
    lower.includes("env") ||
    lower.includes("credential")
  ) {
    return "環境変数が未設定、または設定が不完全です";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed")
  ) {
    return "ネットワークエラーが発生しました";
  }
  if (lower.includes("500") || lower.includes("internal server")) {
    return "サーバー内部エラーが発生しました";
  }
  if (message.length > 160) {
    return `${message.slice(0, 160)}…`;
  }
  return message || "更新に失敗しました。";
}

async function readOpsJson(response: Response): Promise<{
  success?: boolean;
  data?: OpsDashboardPayload;
  error?: string;
}> {
  const text = await response.text();
  if (!text) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("認証に失敗しました。再ログインしてください");
    }
    throw new Error("APIが空の応答を返しました。");
  }
  if (looksLikeHtml(text)) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("認証に失敗しました。再ログインしてください");
    }
    throw new Error("APIがHTMLを返しました（認証切れやサーバーエラーの可能性があります）");
  }
  try {
    return JSON.parse(text) as {
      success?: boolean;
      data?: OpsDashboardPayload;
      error?: string;
    };
  } catch {
    throw new Error("APIがJSON以外の応答を返しました。");
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw new OpsRefreshTimeoutError(label);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function postOpsRefresh(
  source: Exclude<OpsRefreshSource, "all">,
  timeoutMs: number,
  label: string,
): Promise<OpsDashboardPayload> {
  const response = await fetchWithTimeout(
    "/api/admin/ops/refresh",
    {
      method: "POST",
      headers: {
        ...OPS_FETCH_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source }),
    },
    timeoutMs,
    label,
  );

  const json = await readOpsJson(response);
  if (response.status === 401 || response.status === 403) {
    throw new Error("認証に失敗しました。再ログインしてください");
  }
  if (!response.ok || !json.data) {
    throw new Error(json.error ?? "更新に失敗しました。");
  }
  return json.data;
}

export function evaluateSourceRefresh(
  source: OpsRefreshJobKey,
  payload: OpsDashboardPayload,
): { ok: boolean; detail: string } {
  if (source === "ga4") {
    if (payload.ga4.fetchError || payload.ga4.connectionStatus === "error") {
      return {
        ok: false,
        detail: humanizeOpsRefreshError(
          payload.ga4.authDiagnostics?.errorCode
            ? `${payload.ga4.authDiagnostics.errorCode}: ${payload.ga4.fetchError ?? "取得失敗"}`
            : payload.ga4.fetchError ?? "GA4取得に失敗しました。",
        ),
      };
    }
    if (
      !payload.ga4.lastSuccessfulAt &&
      payload.ga4.connectionStatus !== "connected"
    ) {
      return { ok: false, detail: "GA4データを取得できませんでした。" };
    }
    return { ok: true, detail: "成功" };
  }

  if (source === "seo") {
    if (payload.seo.fetchError || payload.seo.connectionStatus === "error") {
      return {
        ok: false,
        detail: humanizeOpsRefreshError(
          payload.seo.fetchError ?? "Search Console取得に失敗しました。",
        ),
      };
    }
    if (
      !payload.seo.updatedAt &&
      payload.seo.connectionStatus !== "connected"
    ) {
      return {
        ok: false,
        detail: "Search Consoleデータを取得できませんでした。",
      };
    }
    return { ok: true, detail: "成功" };
  }

  if (source === "dmm") {
    if (payload.dmm.fetchError || payload.dmm.connectionStatus === "error") {
      return {
        ok: false,
        detail: humanizeOpsRefreshError(
          payload.dmm.fetchError ?? "DMM成果の取得に失敗しました。",
        ),
      };
    }
    if (
      payload.dmm.rowCount <= 0 &&
      payload.dmm.connectionStatus === "unconfigured"
    ) {
      return {
        ok: false,
        detail: "DMM成果データが未取込です。CSVをアップロードしてください。",
      };
    }
    return { ok: true, detail: "成功" };
  }

  if (!payload.seoScore) {
    return { ok: false, detail: "SEOスコアの再生成に失敗しました。" };
  }
  return { ok: true, detail: "成功" };
}

export function formatOpsElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min <= 0) return `${sec}秒`;
  return `${min}分${sec.toString().padStart(2, "0")}秒`;
}
