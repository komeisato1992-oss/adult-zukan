import "server-only";

import { isVercelRuntime } from "@/lib/admin/runtime-fs";

export const ADULT_LOCAL_WRITE_DISABLED_CODE =
  "ADULT_LOCAL_WRITE_DISABLED" as const;

export const ADULT_LOCAL_WRITE_DISABLED_MESSAGE =
  "本番VercelではアダルトカタログJSONへ直接書き込みできません。ローカルで更新しGitへ反映するか、GitHub連携の正規保存を使ってください。" as const;

/**
 * ローカル data/dmm への直接書き込み可否。
 * Vercel上は常に禁止。ローカルでも ADULT_LOCAL_WRITE_ENABLED=true が必須。
 * GitHub API 経由の保存はこのガードの対象外。
 */
export function isAdultLocalWriteAllowed(): boolean {
  if (isVercelRuntime()) return false;
  return process.env.ADULT_LOCAL_WRITE_ENABLED === "true";
}

export function isAdultWriteBlockedReason(): string | null {
  if (isVercelRuntime()) return ADULT_LOCAL_WRITE_DISABLED_MESSAGE;
  if (process.env.ADULT_LOCAL_WRITE_ENABLED !== "true") {
    return "アダルトカタログのローカル書き込みには ADULT_LOCAL_WRITE_ENABLED=true が必要です。";
  }
  return null;
}

export class AdultLocalWriteDisabledError extends Error {
  readonly code = ADULT_LOCAL_WRITE_DISABLED_CODE;
  readonly status = 403;

  constructor(message: string = ADULT_LOCAL_WRITE_DISABLED_MESSAGE) {
    super(message);
    this.name = "AdultLocalWriteDisabledError";
  }
}

export function assertAdultLocalWriteAllowed(context: string): void {
  const reason = isAdultWriteBlockedReason();
  if (reason) {
    throw new AdultLocalWriteDisabledError(`${context}: ${reason}`);
  }
}

export function adultWriteDisabledJsonBody(extra?: Record<string, unknown>) {
  return {
    ok: false as const,
    code: ADULT_LOCAL_WRITE_DISABLED_CODE,
    message: ADULT_LOCAL_WRITE_DISABLED_MESSAGE,
    ...extra,
  };
}
