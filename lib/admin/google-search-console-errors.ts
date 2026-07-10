export type GoogleSearchConsoleErrorCode =
  | "missing_config"
  | "invalid_json"
  | "missing_gsc_site_url"
  | "auth_failed"
  | "permission_denied"
  | "site_not_found"
  | "api_disabled"
  | "unknown";

export class GoogleSearchConsoleError extends Error {
  readonly code: GoogleSearchConsoleErrorCode;
  readonly status: number;

  constructor(
    code: GoogleSearchConsoleErrorCode,
    message: string,
    status = 500,
  ) {
    super(message);
    this.name = "GoogleSearchConsoleError";
    this.code = code;
    this.status = status;
  }
}

function includesAny(text: string, patterns: string[]): boolean {
  const normalized = text.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

export function classifyGoogleAuthError(raw: string): GoogleSearchConsoleError {
  if (includesAny(raw, ["invalid_grant", "invalid jwt", "invalid signature"])) {
    return new GoogleSearchConsoleError(
      "invalid_json",
      "GOOGLE_SERVICE_ACCOUNT_JSON が不正です。JSONの形式、client_email、private_key を確認してください。",
      400,
    );
  }

  if (includesAny(raw, ["accessNotConfigured", "has not been used", "SERVICE_DISABLED"])) {
    return new GoogleSearchConsoleError(
      "api_disabled",
      "Google Search Console API が有効化されていません。Google Cloud Console で API を有効にしてください。",
      503,
    );
  }

  return new GoogleSearchConsoleError(
    "auth_failed",
    `Google 認証に失敗しました: ${raw.slice(0, 200)}`,
    401,
  );
}

export function classifySearchConsoleApiError(
  status: number,
  raw: string,
  siteUrl?: string,
): GoogleSearchConsoleError {
  if (
    status === 403 &&
    includesAny(raw, [
      "accessNotConfigured",
      "has not been used",
      "SERVICE_DISABLED",
    ])
  ) {
    return new GoogleSearchConsoleError(
      "api_disabled",
      "Google Search Console API が有効化されていません。Google Cloud Console で API を有効にしてください。",
      503,
    );
  }

  if (
    status === 403 &&
    includesAny(raw, ["permission", "forbidden", "not sufficient"])
  ) {
    return new GoogleSearchConsoleError(
      "permission_denied",
      "Search Console の権限が不足しています。サービスアカウントをプロパティに「フル」権限で追加してください。",
      403,
    );
  }

  if (status === 404) {
    const siteHint = siteUrl ? `（GSC_SITE_URL: ${siteUrl}）` : "";
    return new GoogleSearchConsoleError(
      "site_not_found",
      `GSC_SITE_URL が Search Console のプロパティと一致していません${siteHint}。URL-prefix 形式なら末尾スラッシュ、ドメイン形式なら sc-domain:example.com を確認してください。`,
      404,
    );
  }

  return new GoogleSearchConsoleError(
    "unknown",
    `Search Console API エラー (${status}): ${raw.slice(0, 300)}`,
    status,
  );
}

export function toGoogleSearchConsoleErrorMessage(error: unknown): {
  message: string;
  status: number;
  code?: GoogleSearchConsoleErrorCode;
} {
  if (error instanceof GoogleSearchConsoleError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code,
    };
  }

  if (error instanceof Error) {
    return { message: error.message, status: 500 };
  }

  return {
    message: "Search Console データの取得に失敗しました。",
    status: 500,
  };
}
