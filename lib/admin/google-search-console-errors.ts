export type GoogleSearchConsoleErrorCode =
  | "missing_config"
  | "invalid_json"
  | "missing_gsc_site_url"
  | "auth_failed"
  | "permission_denied"
  | "site_not_found"
  | "api_disabled"
  | "quota_exceeded"
  | "unknown";

export type GoogleApiErrorDetail = {
  message?: string;
  domain?: string;
  reason?: string;
};

export type ParsedGoogleApiError = {
  httpStatus: number;
  code?: number;
  message: string;
  status?: string;
  errors: GoogleApiErrorDetail[];
  raw: string;
};

export class GoogleSearchConsoleError extends Error {
  readonly code: GoogleSearchConsoleErrorCode;
  readonly status: number;
  readonly apiMethod?: string;
  readonly googleError?: ParsedGoogleApiError;

  constructor(
    code: GoogleSearchConsoleErrorCode,
    message: string,
    status = 500,
    options?: {
      apiMethod?: string;
      googleError?: ParsedGoogleApiError;
    },
  ) {
    super(message);
    this.name = "GoogleSearchConsoleError";
    this.code = code;
    this.status = status;
    this.apiMethod = options?.apiMethod;
    this.googleError = options?.googleError;
  }
}

export function parseGoogleApiErrorBody(
  raw: string,
  httpStatus: number,
): ParsedGoogleApiError {
  try {
    const parsed = JSON.parse(raw) as {
      error?: {
        code?: number;
        message?: string;
        status?: string;
        errors?: GoogleApiErrorDetail[];
      };
    };

    if (parsed.error) {
      return {
        httpStatus,
        code: parsed.error.code ?? httpStatus,
        message: parsed.error.message ?? raw.slice(0, 500),
        status: parsed.error.status,
        errors: parsed.error.errors ?? [],
        raw,
      };
    }
  } catch {
    // fall through
  }

  return {
    httpStatus,
    code: httpStatus,
    message: raw.slice(0, 500) || `HTTP ${httpStatus}`,
    errors: [],
    raw,
  };
}

export function logGoogleApiError(
  context: string,
  apiMethod: string,
  parsed: ParsedGoogleApiError,
  extra?: Record<string, unknown>,
): void {
  console.error(`[seo-gsc] ${context}`, {
    apiMethod,
    status: parsed.httpStatus,
    code: parsed.code,
    message: parsed.message,
    googleStatus: parsed.status,
    errors: parsed.errors,
    ...extra,
  });
}

function includesAny(text: string, patterns: string[]): boolean {
  const normalized = text.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function hasErrorReason(parsed: ParsedGoogleApiError, reasons: string[]): boolean {
  return parsed.errors.some((entry) =>
    reasons.some((reason) => entry.reason?.toLowerCase() === reason.toLowerCase()),
  );
}

function isApiDisabledError(parsed: ParsedGoogleApiError): boolean {
  if (hasErrorReason(parsed, ["accessNotConfigured", "SERVICE_DISABLED"])) {
    return true;
  }

  const combined = `${parsed.message} ${parsed.raw}`;
  return (
    parsed.status === "PERMISSION_DENIED" &&
    includesAny(combined, ["accessNotConfigured", "SERVICE_DISABLED"]) &&
    includesAny(combined, ["has not been used", "it is disabled", "Enable it by visiting"])
  );
}

function isPermissionDeniedError(parsed: ParsedGoogleApiError): boolean {
  if (
    hasErrorReason(parsed, [
      "forbidden",
      "insufficientPermissions",
      "insufficientPermission",
    ])
  ) {
    return true;
  }

  if (parsed.status === "PERMISSION_DENIED") {
    return true;
  }

  return includesAny(parsed.message, [
    "does not have sufficient permission",
    "permission denied",
    "not authorized",
    "forbidden",
  ]);
}

export function formatGoogleApiErrorForDisplay(parsed: ParsedGoogleApiError): string {
  const statusLabel =
    parsed.status ??
    (parsed.httpStatus === 401
      ? "UNAUTHORIZED"
      : parsed.httpStatus === 403
        ? "PERMISSION_DENIED"
        : parsed.httpStatus === 404
          ? "NOT_FOUND"
          : parsed.httpStatus === 429
            ? "RESOURCE_EXHAUSTED"
            : undefined);

  const headline = [parsed.httpStatus, statusLabel].filter(Boolean).join(" ");
  const detail = parsed.errors
    .map((entry) => entry.message || entry.reason)
    .filter(Boolean)
    .join(" / ");

  if (detail) {
    return `${headline}\n${parsed.message}\n${detail}`;
  }

  return `${headline}\n${parsed.message}`;
}

export function classifyGoogleAuthError(
  raw: string,
  httpStatus: number,
): GoogleSearchConsoleError {
  const parsed = parseGoogleApiErrorBody(raw, httpStatus);
  logGoogleApiError("Google OAuth token error", "oauth2.token", parsed);

  if (includesAny(raw, ["invalid_grant", "invalid jwt", "invalid signature"])) {
    return new GoogleSearchConsoleError(
      "invalid_json",
      formatGoogleApiErrorForDisplay(parsed),
      httpStatus,
      { apiMethod: "oauth2.token", googleError: parsed },
    );
  }

  if (isApiDisabledError(parsed)) {
    return new GoogleSearchConsoleError(
      "api_disabled",
      formatGoogleApiErrorForDisplay(parsed),
      httpStatus,
      { apiMethod: "oauth2.token", googleError: parsed },
    );
  }

  return new GoogleSearchConsoleError(
    "auth_failed",
    formatGoogleApiErrorForDisplay(parsed),
    httpStatus,
    { apiMethod: "oauth2.token", googleError: parsed },
  );
}

export function classifySearchConsoleApiError(
  httpStatus: number,
  raw: string,
  options?: {
    siteUrl?: string;
    apiMethod?: string;
  },
): GoogleSearchConsoleError {
  const parsed = parseGoogleApiErrorBody(raw, httpStatus);
  logGoogleApiError("Search Console API error", options?.apiMethod ?? "unknown", parsed, {
    siteUrl: options?.siteUrl,
  });

  if (isApiDisabledError(parsed)) {
    return new GoogleSearchConsoleError(
      "api_disabled",
      formatGoogleApiErrorForDisplay(parsed),
      httpStatus,
      { apiMethod: options?.apiMethod, googleError: parsed },
    );
  }

  if (httpStatus === 401 || parsed.status === "UNAUTHENTICATED") {
    return new GoogleSearchConsoleError(
      "auth_failed",
      formatGoogleApiErrorForDisplay(parsed),
      401,
      { apiMethod: options?.apiMethod, googleError: parsed },
    );
  }

  if (httpStatus === 429 || parsed.status === "RESOURCE_EXHAUSTED") {
    return new GoogleSearchConsoleError(
      "quota_exceeded",
      formatGoogleApiErrorForDisplay(parsed),
      429,
      { apiMethod: options?.apiMethod, googleError: parsed },
    );
  }

  if (httpStatus === 404 || parsed.status === "NOT_FOUND") {
    const siteHint = options?.siteUrl ? `\nGSC_SITE_URL: ${options.siteUrl}` : "";
    return new GoogleSearchConsoleError(
      "site_not_found",
      `${formatGoogleApiErrorForDisplay(parsed)}${siteHint}`,
      404,
      { apiMethod: options?.apiMethod, googleError: parsed },
    );
  }

  if (httpStatus === 403 && isPermissionDeniedError(parsed)) {
    return new GoogleSearchConsoleError(
      "permission_denied",
      formatGoogleApiErrorForDisplay(parsed),
      403,
      { apiMethod: options?.apiMethod, googleError: parsed },
    );
  }

  return new GoogleSearchConsoleError(
    "unknown",
    formatGoogleApiErrorForDisplay(parsed),
    httpStatus,
    { apiMethod: options?.apiMethod, googleError: parsed },
  );
}

export function toGoogleSearchConsoleErrorMessage(error: unknown): {
  message: string;
  status: number;
  code?: GoogleSearchConsoleErrorCode;
  apiMethod?: string;
  googleStatus?: string;
  googleErrors?: GoogleApiErrorDetail[];
} {
  if (error instanceof GoogleSearchConsoleError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code,
      apiMethod: error.apiMethod,
      googleStatus: error.googleError?.status,
      googleErrors: error.googleError?.errors,
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
