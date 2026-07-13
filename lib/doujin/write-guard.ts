import "server-only";

import { isVercelRuntime } from "@/lib/admin/runtime-fs";

export const DOUJIN_LOCAL_WRITE_DISABLED_CODE =
  "LOCAL_WRITE_DISABLED_IN_PRODUCTION" as const;

export const DOUJIN_LOCAL_WRITE_DISABLED_MESSAGE =
  "本番VercelではJSONファイルへ永続保存できません。ローカル環境で同期を実行し、変更をGitへ反映してください。" as const;

/**
 * 同人 JSON / raw への書き込み可否。
 * 安全側: Vercel上は常に禁止。ローカルでも DOUJIN_LOCAL_WRITE_ENABLED=true が必須。
 * 環境変数だけに依存せず、VERCEL 判定を併用する。
 */
export function isDoujinLocalWriteAllowed(): boolean {
  if (isVercelRuntime()) return false;
  return process.env.DOUJIN_LOCAL_WRITE_ENABLED === "true";
}

export function isDoujinWriteBlockedReason(): string | null {
  if (isVercelRuntime()) {
    return DOUJIN_LOCAL_WRITE_DISABLED_MESSAGE;
  }
  if (process.env.DOUJIN_LOCAL_WRITE_ENABLED !== "true") {
    return "同人JSONの書き込みには DOUJIN_LOCAL_WRITE_ENABLED=true が必要です。";
  }
  return null;
}

export class DoujinLocalWriteDisabledError extends Error {
  readonly code = DOUJIN_LOCAL_WRITE_DISABLED_CODE;
  readonly status = 403;

  constructor(message: string = DOUJIN_LOCAL_WRITE_DISABLED_MESSAGE) {
    super(message);
    this.name = "DoujinLocalWriteDisabledError";
  }
}

export function assertDoujinLocalWriteAllowed(context: string): void {
  const reason = isDoujinWriteBlockedReason();
  if (reason) {
    throw new DoujinLocalWriteDisabledError(`${context}: ${reason}`);
  }
}

export function doujinWriteDisabledJsonBody(extra?: Record<string, unknown>) {
  return {
    ok: false as const,
    code: DOUJIN_LOCAL_WRITE_DISABLED_CODE,
    message: DOUJIN_LOCAL_WRITE_DISABLED_MESSAGE,
    ...extra,
  };
}
